import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const XML = `<node><interface name="studio.tomato.Guard1">
<method name="ListWindows"><arg type="s" direction="out"/></method>
<method name="FocusWindow"><arg type="u" direction="in"/><arg type="b" direction="out"/></method>
</interface></node>`;

export default class TomatoGuard extends Extension {
    enable() {
        this._dbus = Gio.DBusExportedObject.wrapJSObject(XML, this);
        this._dbus.export(Gio.DBus.session, '/studio/tomato/Guard');
    }

    disable() {
        this._dbus?.unexport();
        this._dbus = null;
    }

    _windows() {
        // Include dialogs and minimized/off-workspace windows; shell chrome has
        // no application PID and cannot satisfy the app's protection preflight.
        return global.get_window_actors().map(actor => actor.meta_window);
    }

    ListWindows() {
        const tracker = Shell.WindowTracker.get_default();
        return JSON.stringify(this._windows().map(window => ({
            id: window.get_stable_sequence(),
            app_id: tracker.get_window_app(window)?.get_id() ?? window.get_wm_class(),
            title: window.get_title(),
            pid: window.get_pid() > 0 ? window.get_pid() : null,
            is_focused: global.display.focus_window === window,
        })));
    }

    FocusWindow(id) {
        const window = this._windows().find(w => w.get_stable_sequence() === id);
        if (!window)
            throw new Error('Window closed');
        window.unminimize();
        const time = global.get_current_time();
        const workspace = window.get_workspace();
        if (workspace && workspace !== global.workspace_manager.get_active_workspace())
            workspace.activate_with_focus(window, time);
        else
            window.activate(time);
        return global.display.focus_window === window;
    }
}
