"""Private GNOME/KWin D-Bus fixture. Never connect this to a real desktop bus."""
import json
import os
from pathlib import Path
import subprocess
import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib

assert os.environ.get("TOMATO_SHELL_TEST_ISOLATED") == "1"
connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)
windows = []
scripts = {}
registrations = {}
counter = 0
legacy = False


def return_tuple(invocation, signature="()", value=()):
    invocation.return_value(GLib.Variant(signature, value))


def method(conn, sender, path, interface, name, args, invocation):
    global windows, counter, legacy
    parameters = args.unpack()
    if name == "Reset":
        legacy = parameters[1]
        windows = [{"native_id": str(i), "id": i, "app_id": app, "title": app,
                    "pid": parameters[0] if i == 1 else i * 100, "is_focused": i == 3}
                   for i, app in enumerate(["tomato-todo", "org.tomato.Allowed", "org.tomato.Blocked"], 1)]
        return_tuple(invocation)
    elif name == "ListWindows":
        return_tuple(invocation, "(s)", (json.dumps(windows),))
    elif name == "FocusWindow":
        for window in windows:
            window["is_focused"] = window["id"] == parameters[0]
        return_tuple(invocation, "(b)", (True,))
    elif name == "loadScript":
        counter += 1
        scripts[counter] = (Path(parameters[0]).read_text(), parameters[1])
        registrations[counter] = connection.register_object((f"/{counter}" if legacy else f"/Scripting/Script{counter}"), script_info, method, None, None)
        return_tuple(invocation, "(i)", (counter,))
    elif name == "unloadScript":
        for identifier, (_, script_name) in list(scripts.items()):
            if script_name == parameters[0]:
                del scripts[identifier]
                connection.unregister_object(registrations.pop(identifier))
        return_tuple(invocation, "(b)", (True,))
    elif name == "stop":
        return_tuple(invocation)
    elif name == "run":
        identifier = int(path.rsplit("Script", 1)[1] if "Script" in path else path[1:])
        # Execute the actual generated JavaScript against a small Workspace API.
        source = """
const vm = require('node:vm');
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const windows = input.windows.map(w => ({internalId:w.native_id, desktopFileName:w.app_id,
caption:w.title, pid:w.pid, active:w.is_focused, minimized:false, specialWindow:false, deleted:false}));
const workspace = input.legacy ? {clientList:()=>windows} : {windowList:()=>windows};
Object.defineProperty(workspace, input.legacy ? 'activeClient' : 'activeWindow', {get:()=>windows.find(w=>w.active),
set:target=>windows.forEach(w=>w.active=w===target)});
let reply;
vm.runInNewContext(input.script, {workspace, callDBus:(...args)=>reply=args});
console.log(JSON.stringify({reply, windows:windows.map(w=>w.active)}));
"""
        output = subprocess.run(["node", "-e", source], input=json.dumps({"script": scripts[identifier][0], "windows": windows, "legacy": legacy}), text=True, capture_output=True, check=True)
        result = json.loads(output.stdout)
        for window, active in zip(windows, result["windows"]):
            window["is_focused"] = active
        destination, target, iface, member, payload = result["reply"]
        return_tuple(invocation)
        def send_reply():
            connection.call(destination, target, iface, member, GLib.Variant("(s)", (payload,)),
                            None, Gio.DBusCallFlags.NONE, 1000, None, None, None)
            return False
        GLib.idle_add(send_reply)
    else:
        invocation.return_dbus_error("studio.tomato.Unknown", name)


shell_info = Gio.DBusNodeInfo.new_for_xml("""<node><interface name="studio.tomato.Guard1">
<method name="Reset"><arg type="u" direction="in"/><arg type="b" direction="in"/></method>
<method name="ListWindows"><arg type="s" direction="out"/></method>
<method name="FocusWindow"><arg type="u" direction="in"/><arg type="b" direction="out"/></method>
</interface></node>""").interfaces[0]
scripting_info = Gio.DBusNodeInfo.new_for_xml("""<node><interface name="org.kde.kwin.Scripting">
<method name="loadScript"><arg type="s" direction="in"/><arg type="s" direction="in"/><arg type="i" direction="out"/></method>
<method name="unloadScript"><arg type="s" direction="in"/><arg type="b" direction="out"/></method>
</interface></node>""").interfaces[0]
script_info = Gio.DBusNodeInfo.new_for_xml("""<node><interface name="org.kde.kwin.Script"><method name="run"/><method name="stop"/></interface></node>""").interfaces[0]
connection.register_object("/studio/tomato/Guard", shell_info, method, None, None)
connection.register_object("/Scripting", scripting_info, method, None, None)
for name in ("org.gnome.Shell", "org.kde.KWin"):
    connection.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "RequestName",
                         GLib.Variant("(su)", (name, 4)), None, Gio.DBusCallFlags.NONE, 1000, None)
print("READY", flush=True)
GLib.MainLoop().run()
