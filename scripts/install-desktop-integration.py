#!/usr/bin/env python3
"""Install the optional GNOME Shell bridge without enabling desktop protection."""
import argparse
import json
import os
from pathlib import Path
import shutil

UUID = "tomato-guard@studio.tomato.todo"


def install(args):
    base = Path(__file__).resolve().parent
    candidates = [base / "desktop-integrations/gnome", base.parent / "desktop-integrations/gnome"]
    source = next((p for p in candidates if (p / "metadata.json").is_file()), None)
    if source is None:
        raise ValueError("GNOME extension resources not found beside the installer")
    home = Path(args.home).resolve() if args.home else Path.home()
    configured = os.environ.get("XDG_DATA_HOME") if not args.home else None
    data = Path(configured) if configured and Path(configured).is_absolute() else home / ".local/share"
    target = data / "gnome-shell/extensions" / UUID
    if target.exists():
        metadata = json.loads((target / "metadata.json").read_text())
        if metadata.get("uuid") != UUID:
            raise ValueError(f"Refusing to replace another extension: {target}")
    if not args.dry_run:
        target.mkdir(parents=True, exist_ok=True)
        for name in ("metadata.json", "extension.js"):
            shutil.copyfile(source / name, target / name)
    print(json.dumps({"extension": str(target), "enable": f"gnome-extensions enable {UUID}",
                      "note": "首次安装后注销并重新登录，再启用扩展；未自动启用扩展或专注保护。"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", help="Isolated home for installation tests")
    parser.add_argument("--dry-run", action="store_true")
    install(parser.parse_args())
