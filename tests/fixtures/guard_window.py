"""A disposable native X11/Wayland window for the isolated compositor test."""
import sys
import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GLib

GLib.set_prgname(sys.argv[1])

app = Gtk.Application(application_id=sys.argv[1])


def activate(application):
    window = Gtk.ApplicationWindow(application=application, title=sys.argv[1])
    # GTK otherwise derives the same WM_CLASS from this shared fixture script.
    window.set_wmclass(sys.argv[1], sys.argv[1])
    window.set_default_size(600, 400)
    window.add(Gtk.Label(label=sys.argv[1]))
    window.show_all()


app.connect("activate", activate)
app.run([])
