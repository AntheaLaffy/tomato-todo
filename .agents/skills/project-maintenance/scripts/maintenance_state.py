#!/usr/bin/env python3
"""Track changes since a deliberate project-maintenance review; never delete code."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


STATE_PATH = Path(".project-maintenance/state.json")
SCHEMA_VERSION = 1
CACHE_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "target", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".cache",
}
GENERATED_ROOTS = {"build", "dist", "out", "coverage"}


def git(root: Path, *args: str, optional: bool = False) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, check=False
    )
    if result.returncode and not optional:
        raise ValueError(result.stderr.decode(errors="replace").strip())
    return b"" if result.returncode else result.stdout


def repo_root(directory: str) -> Path:
    result = git(Path(directory).resolve(), "rev-parse", "--show-toplevel")
    return Path(os.fsdecode(result.rstrip(b"\n"))).resolve()


def load_state(root: Path) -> dict | None:
    path = root / STATE_PATH
    if not path.exists():
        return None
    if path.is_symlink():
        raise ValueError("Maintenance state must be a regular file, not a symlink")
    state = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(state, dict) or state.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("Unsupported or malformed maintenance state")
    for field in ("files", "maps"):
        entries = state.get(field)
        if not isinstance(entries, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in entries.items()
        ):
            raise ValueError(f"Malformed state field: {field}")
    if not isinstance(state.get("excludes"), list) or not all(
        isinstance(p, str) for p in state["excludes"]
    ) or not isinstance(state.get("include_generated"), bool):
        raise ValueError("Malformed maintenance scope")
    return state


def excluded(name: str, patterns: list[str], include_generated: bool) -> bool:
    parts = Path(name).parts
    if not parts or parts[0] == STATE_PATH.parts[0]:
        return True
    if any(part in CACHE_DIRS for part in parts[:-1]):
        return True
    if not include_generated and parts[0] in GENERATED_ROOTS:
        return True
    return any(
        name.startswith(pattern) if pattern.endswith("/")
        else fnmatch.fnmatchcase(name, pattern)
        for pattern in patterns
    )


def fingerprint(path: Path) -> tuple[str, dict | None]:
    if path.is_symlink():
        target = os.readlink(path)
        digest = hashlib.sha256(os.fsencode(target)).hexdigest()
        return "symlink:" + digest, {"kind": "symlink", "target": target}
    if path.is_dir():
        # Git ls-files emits a directory only for a gitlink. Its own tree needs review.
        child_root = git(path, "rev-parse", "--show-toplevel", optional=True)
        initialized = bool(child_root) and Path(
            os.fsdecode(child_root.rstrip(b"\n"))
        ).resolve() == path.resolve()
        if initialized:
            payload = git(path, "rev-parse", "HEAD", optional=True) + git(
                path, "status", "--porcelain=v1", "-z", "--untracked-files=all"
            )
        else:
            payload = b"uninitialized"
        return "gitlink:" + hashlib.sha256(payload).hexdigest(), {
            "kind": "submodule", "initialized": initialized,
        }
    before = path.stat()
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns, before.st_mode) != (
        after.st_size, after.st_mtime_ns, after.st_mode
    ):
        raise ValueError(f"File changed during scan; retry: {path}")
    executable = "x" if before.st_mode & 0o111 else "-"
    return "file:" + executable + ":" + digest.hexdigest(), None


def inventory(root: Path, patterns: list[str], include_generated: bool) -> dict:
    output = git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    names = sorted({os.fsdecode(name) for name in output.split(b"\0") if name})
    files, maps, separate = {}, {}, []
    for name in names:
        if excluded(name, patterns, include_generated):
            continue
        path = root / name
        if not os.path.lexists(path):
            continue  # Tracked deletions are absent from the current content manifest.
        value, checkout = fingerprint(path)
        target = maps if path.name in {"CODEMAP.md", "codemap.md"} or (
            path.name.endswith(".analysis.md")
        ) else files
        target[name] = value
        if checkout:
            separate.append({"path": name, **checkout})
    return {"files": files, "maps": maps, "separate_checkouts": separate}


def differences(old: dict, new: dict) -> dict:
    return {
        "added": sorted(new.keys() - old.keys()),
        "modified": sorted(k for k in old.keys() & new.keys() if old[k] != new[k]),
        "removed": sorted(old.keys() - new.keys()),
    }


def write_state(root: Path, state: dict) -> None:
    directory = root / STATE_PATH.parent
    if directory.is_symlink():
        raise ValueError("Maintenance state directory must not be a symlink")
    directory.mkdir(exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=directory, prefix=".state-", delete=False
        ) as stream:
            temporary = Path(stream.name)
            json.dump(state, stream, indent=2, sort_keys=True)
            stream.write("\n")
        os.replace(temporary, directory / STATE_PATH.name)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def paginate_report(report: dict, max_paths: int, offset: int) -> dict:
    # Keep full counts and review status; pagination is presentation, not scope.
    entries = [
        (group, kind, name)
        for group in ("maps", "files")
        for kind, names in report["changes"][group].items()
        for name in names
    ]
    entries.extend(("separate_checkouts", "", item)
                   for item in report["separate_checkouts"])
    page = entries[offset:offset + max_paths]
    limited = {
        **report,
        "change_counts": {
            group: {kind: len(names) for kind, names in changes.items()}
            for group, changes in report["changes"].items()
        },
        "separate_checkout_count": len(report["separate_checkouts"]),
        "changes": {
            group: {kind: [] for kind in changes}
            for group, changes in report["changes"].items()
        },
        "separate_checkouts": [],
        "pagination": {
            "offset": offset, "limit": max_paths, "total": len(entries),
            "returned": len(page), "omitted": len(entries) - len(page),
            "truncated": len(page) < len(entries),
            "next_offset": offset + len(page) if page and (
                offset + len(page) < len(entries)
            ) else None,
        },
    }
    for group, kind, item in page:
        if group == "separate_checkouts":
            limited[group].append(item)
        else:
            limited["changes"][group][kind].append(item)
    return limited


def print_report(report: dict, as_json: bool) -> None:
    if as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
        return
    print(f"Project: {report['root']}")
    print(f"Status: {report['status']}")
    for group in ("files", "maps"):
        print(f"{group}: {report['counts'][group]} monitored")
        for kind, paths in report["changes"][group].items():
            if paths:
                print(f"  {kind}: {len(paths)}")
                for name in paths[:40]:
                    print("    " + ascii(name))
                if len(paths) > 40:
                    print("    ... use --json for the complete list")
    if report["scope_changed"]:
        print("Scope changed; review exclusions before recording")
    if report["separate_checkouts"]:
        print("Linked/submodule content requires separate review:")
        for checkout in report["separate_checkouts"]:
            print("  " + ascii(checkout["path"]) + " (" + checkout["kind"] + ")")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("inspect", "record", "check"))
    parser.add_argument("--root", required=True, help="Path inside the intended Git project")
    parser.add_argument("--json", action="store_true", help="Emit structured output; complete unless --max-paths is set")
    parser.add_argument("--max-paths", type=int, help="Limit total JSON change/checkout entries; 0 emits counts only")
    parser.add_argument("--offset", type=int, default=0, help="Skip entries when using --max-paths")
    parser.add_argument("--reviewed", action="store_true", help="Record only after actual review")
    parser.add_argument("--exclude", action="append", help="Replace custom root-relative exclusions")
    parser.add_argument("--clear-excludes", action="store_true")
    parser.add_argument("--include-generated", action="store_true", default=None)
    parser.add_argument("--exclude-generated", dest="include_generated", action="store_false", default=None)
    args = parser.parse_args()
    if args.action == "record" and not args.reviewed:
        parser.error("record requires --reviewed after maintenance and verification")
    if args.reviewed and args.action != "record":
        parser.error("--reviewed applies only to record")
    if args.exclude is not None and args.clear_excludes:
        parser.error("Use --exclude or --clear-excludes, not both")
    if args.max_paths is not None and (not args.json or args.max_paths < 0):
        parser.error("--max-paths requires --json and a nonnegative limit")
    if args.offset < 0 or (args.offset and args.max_paths is None):
        parser.error("--offset requires --max-paths and a nonnegative offset")
    try:
        root = repo_root(args.root)
        old = load_state(root)
        patterns = sorted(set(args.exclude)) if args.exclude is not None else (
            [] if args.clear_excludes else (old or {}).get("excludes", [])
        )
        if any(not p or p.startswith("/") or ".." in Path(p).parts for p in patterns):
            raise ValueError("Exclusions must be nonempty root-relative patterns without '..'")
        include_generated = args.include_generated if args.include_generated is not None else (
            (old or {}).get("include_generated", False)
        )
        current = inventory(root, patterns, include_generated)
        changes = {group: differences((old or {}).get(group, {}), current[group])
                   for group in ("files", "maps")}
        scope_changed = old is not None and (
            patterns != old["excludes"] or include_generated != old["include_generated"]
        )
        needs_review = old is None or scope_changed or any(
            paths for group in changes.values() for paths in group.values()
        )
        status = "review-required" if needs_review else "matches-reviewed-state"
        if args.action == "record":
            state = {
                "schema_version": SCHEMA_VERSION,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "head": git(root, "rev-parse", "--verify", "HEAD", optional=True).decode().strip() or None,
                "excludes": patterns, "include_generated": include_generated, **current,
            }
            write_state(root, state)
            status = "recorded-reviewed-state"
        report = {
            "root": str(root), "status": status, "scope_changed": scope_changed,
            "counts": {group: len(current[group]) for group in ("files", "maps")},
            "changes": changes, "separate_checkouts": current["separate_checkouts"],
            "excludes": patterns, "include_generated": include_generated,
        }
        if args.max_paths is not None:
            snapshot = {
                "current": current, "reviewed": old,
                "excludes": patterns, "include_generated": include_generated,
            }
            report["report_id"] = hashlib.sha256(
                json.dumps(snapshot, sort_keys=True).encode()
            ).hexdigest()
            report = paginate_report(report, args.max_paths, args.offset)
        print_report(report, args.json)
        return int(needs_review) if args.action == "check" else 0
    except (OSError, ValueError, UnicodeError) as error:
        if args.json:
            print(json.dumps({"error": str(error)}), file=sys.stderr)
        else:
            print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
