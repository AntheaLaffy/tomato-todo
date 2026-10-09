"""A private StatusNotifier host and client for real tray/menu integration tests."""
import json
import sys
import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib

BUS = "org.kde.StatusNotifierWatcher"
PATH = "/StatusNotifierWatcher"
IFACE = BUS
connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)


def call(destination, path, interface, method, arguments):
    return connection.call_sync(destination, path, interface, method, arguments,
                                None, Gio.DBusCallFlags.NONE, 4000, None).unpack()


if len(sys.argv) > 1 and sys.argv[1] != "watch":
    items = call(BUS, PATH, "org.freedesktop.DBus.Properties", "Get",
                 GLib.Variant("(ss)", (IFACE, "RegisteredStatusNotifierItems")))[0]
    if not items:
        print("null")
        sys.exit(0)
    destination, item_path = items[0].split("/", 1)
    menu_path = call(destination, "/" + item_path, "org.freedesktop.DBus.Properties", "Get",
                     GLib.Variant("(ss)", ("org.kde.StatusNotifierItem", "Menu")))[0]
    if sys.argv[1] == "layout":
        layout = call(destination, menu_path, "com.canonical.dbusmenu", "GetLayout",
                      GLib.Variant("(iias)", (0, -1, [])))
        print(json.dumps(layout, ensure_ascii=False))
    elif sys.argv[1] == "event":
        call(destination, menu_path, "com.canonical.dbusmenu", "Event",
             GLib.Variant("(isvu)", (int(sys.argv[2]), "clicked", GLib.Variant("i", 0), 0)))
    else:
        raise ValueError("Unknown command")
    sys.exit(0)

items = []
xml = """<node><interface name="org.kde.StatusNotifierWatcher">
<method name="RegisterStatusNotifierItem"><arg type="s" direction="in"/></method>
<method name="RegisterStatusNotifierHost"><arg type="s" direction="in"/></method>
<property name="RegisteredStatusNotifierItems" type="as" access="read"/>
<property name="IsStatusNotifierHostRegistered" type="b" access="read"/>
<property name="ProtocolVersion" type="i" access="read"/>
<signal name="StatusNotifierItemRegistered"><arg type="s"/></signal>
<signal name="StatusNotifierItemUnregistered"><arg type="s"/></signal>
<signal name="StatusNotifierHostRegistered"/>
</interface></node>"""


def method(conn, sender, path, interface, name, parameters, invocation):
    if name == "RegisterStatusNotifierItem":
        argument = parameters.unpack()[0]
        item = sender + argument if argument.startswith("/") else argument + "/StatusNotifierItem"
        if item not in items:
            items.append(item)
            conn.emit_signal(None, PATH, IFACE, "StatusNotifierItemRegistered", GLib.Variant("(s)", (item,)))
    invocation.return_value(None)


def property_value(conn, sender, path, interface, name):
    if name == "RegisteredStatusNotifierItems":
        return GLib.Variant("as", items)
    if name == "IsStatusNotifierHostRegistered":
        return GLib.Variant("b", True)
    return GLib.Variant("i", 0)


node = Gio.DBusNodeInfo.new_for_xml(xml)
connection.register_object(PATH, node.interfaces[0], method, property_value, None)
Gio.bus_own_name_on_connection(connection, BUS, Gio.BusNameOwnerFlags.NONE, None, None)
GLib.MainLoop().run()
