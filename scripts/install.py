#!/usr/bin/env python3
"""Install the Linux build for one user; preserve existing desktop settings."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
APP_ID = "studio.tomato.todo"
DESKTOP_ID = "tomato-todo"
MANAGED = "X-Tomato-Todo-Managed=true"


def atomic_write(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".tomato-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def quote_exec(path):
    raw = str(path)
    if any(c in raw for c in "\n\r\0"):
        raise ValueError("Invalid executable path")
    raw = raw.replace("\\", "\\\\\\\\").replace('"', '\\\\\\"')
    raw = raw.replace("`", "\\\\`").replace("$", "\\\\$").replace("%", "%%")
    return '"' + raw + '"'


def install(args):
    home = Path(args.home).resolve() if args.home else Path.home()
    def xdg(name, fallback):
        configured = os.environ.get(name) if not args.home else None
        return Path(configured) if configured and Path(configured).is_absolute() else home / fallback
    data = xdg("XDG_DATA_HOME", ".local/share")
    config = xdg("XDG_CONFIG_HOME", ".config")
    state = xdg("XDG_STATE_HOME", ".local/state")
    source = Path(args.binary).resolve()
    binary = home / ".local/lib/tomato-todo/tomato-todo"
    launcher = home / ".local/bin/tomato-todo"
    entry = data / "applications" / (DESKTOP_ID + ".desktop")
    autostart = config / "autostart" / (APP_ID + ".desktop")
    if not source.is_file():
        raise ValueError("Build the release binary first: npm run desktop:build")
    if launcher.exists() or launcher.is_symlink():
        if not launcher.is_symlink() or launcher.resolve() != binary:
            raise ValueError(f"Refusing to replace an unrelated launcher: {launcher}")
    for path in (entry, autostart):
        if path.exists() and MANAGED not in path.read_text().splitlines():
            raise ValueError(f"Refusing to replace an unmanaged desktop entry: {path}")

    patches = []
    settings_path = config / "DankMaterialShell/settings.json"
    session_path = state / "DankMaterialShell/session.json"
    if args.pin_dms:
        if not settings_path.is_file() or not session_path.is_file():
            raise ValueError("DankMaterialShell settings and session files must exist")
        session = json.loads(session_path.read_text())
        settings = json.loads(settings_path.read_text())
        pins = session.setdefault("barPinnedApps", [])
        if DESKTOP_ID not in pins:
            pins.append(DESKTOP_ID)
            patches.append((session_path, session))
        active = [bar for bar in settings.get("barConfigs", []) if bar.get("enabled", True)]
        if not active:
            raise ValueError("No enabled DankMaterialShell bar was found")
        changed = False
        for bar in active:
            sections = [bar.get(name, []) for name in ("leftWidgets", "centerWidgets", "rightWidgets")]
            def widget_id(widget):
                return widget if isinstance(widget, str) else widget.get("id")
            if not any(widget_id(widget) == "appsDock" for section in sections for widget in section):
                widgets = bar.setdefault("leftWidgets", [])
                insert = next((index for index, widget in enumerate(widgets)
                               if widget_id(widget) == "focusedWindow"), len(widgets))
                widgets.insert(insert, "appsDock")
                changed = True
        if changed:
            patches.append((settings_path, settings))
    plan = {"binary": str(binary), "launcher": str(launcher), "application": str(entry),
            "autostart": str(autostart) if args.autostart else None,
            "dmsChanges": [str(path) for path, _ in patches]}
    if args.dry_run:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return

    if patches:
        backup = data / APP_ID / "install-backups" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup.mkdir(parents=True)
        for path, _ in patches:
            shutil.copy2(path, backup / path.name)
    atomic_write(binary, source.read_bytes(), 0o755)
    launcher.parent.mkdir(parents=True, exist_ok=True)
    if not launcher.is_symlink():
        launcher.symlink_to(binary)
    desktop = ("[Desktop Entry]\nType=Application\nName=番茄 Todo\nName[en]=Tomato Todo\n"
               "Comment=任务与番茄钟，一个安静的专注空间\n"
               f"Exec={quote_exec(binary)}\nIcon=tomato-todo\nTerminal=false\nCategories=Office;\n"
               f"StartupWMClass={DESKTOP_ID}\nStartupNotify=true\nKeywords=Pomodoro;Todo;Focus;番茄;专注;\n{MANAGED}\n")
    atomic_write(entry, desktop.encode())
    for size, filename in ((32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")):
        icon = data / "icons/hicolor" / f"{size}x{size}" / "apps/tomato-todo.png"
        atomic_write(icon, (ROOT / "src-tauri/icons" / filename).read_bytes())
    if args.autostart:
        startup = ("[Desktop Entry]\nType=Application\nName=番茄 Todo\n"
                   f"Exec={quote_exec(binary)} --background\nIcon=tomato-todo\nTerminal=false\n"
                   f"StartupNotify=false\n{MANAGED}\n")
        atomic_write(autostart, startup.encode())
    for path, obj in patches:
        atomic_write(path, (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode(), 0o600)
    for command in (("update-desktop-database", str(entry.parent)),
                    ("gtk-update-icon-cache", "--force", "--ignore-theme-index", str(data / "icons/hicolor"))):
        if shutil.which(command[0]):
            subprocess.run(command, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(json.dumps(plan, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default=str(ROOT / "target/release/tomato-todo"))
    parser.add_argument("--home", help="Isolated home directory for tests")
    parser.add_argument("--autostart", action="store_true")
    parser.add_argument("--pin-dms", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    install(parser.parse_args())
