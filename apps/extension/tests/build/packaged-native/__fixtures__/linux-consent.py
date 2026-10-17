"""Operate owned native browser permission and download controls through AT-SPI."""

import json
import sys
import time

import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi, GLib  # noqa: E402


def descendants(element, depth=0):
    """Read native chrome only; extension HTML must never impersonate consent."""
    if depth > 25 or element.get_role() == Atspi.Role.DOCUMENT_WEB:
        return []
    nodes = [element]
    for index in range(element.get_child_count()):
        child = element.get_child_at_index(index)
        if child is not None:
            nodes.extend(descendants(child, depth + 1))
    return nodes


def screen_extents(element):
    """Read native screen bounds only when both required visibility states are present."""
    states = element.get_state_set()
    if not all(states.contains(state) for state in (Atspi.StateType.VISIBLE, Atspi.StateType.SHOWING)):
        return None
    component = element.get_component_iface()
    if component is None:
        return None
    bounds = component.get_extents(Atspi.CoordType.SCREEN)
    return {"x": bounds.x, "y": bounds.y, "width": bounds.width, "height": bounds.height}


def contains_point(bounds, point):
    """Keep native screen coordinates inside the element's nonempty pixel bounds."""
    return (bounds is not None and bounds["width"] > 0 and bounds["height"] > 0
            and bounds["x"] <= point["x"] < bounds["x"] + bounds["width"]
            and bounds["y"] <= point["y"] < bounds["y"] + bounds["height"])


def dismiss_downloads(pid, point):
    """Click a verified neutral page point outside only this browser's download popup."""
    if not isinstance(point, dict) or any(type(point.get(axis)) is not int for axis in ("x", "y")):
        raise ValueError("Native download dismissal requires integer heading screen coordinates")
    deadline = time.monotonic() + 15
    absent_since = None
    clicks = []
    observed = []
    while time.monotonic() < deadline:
        context = GLib.MainContext.default()
        while context.pending():
            context.iteration(False)
        desktop = Atspi.get_desktop(0)
        owned = False
        dialogs = []
        other_dialogs = []
        frames = []
        observed = []
        for index in range(desktop.get_child_count()):
            application = desktop.get_child_at_index(index)
            if application.get_process_id() != pid:
                continue
            # Refresh the owned native tree so a dismissed popup cannot retain cached SHOWING state.
            application.clear_cache()
            owned = True
            for window_index in range(application.get_child_count()):
                window = application.get_child_at_index(window_index)
                if window.get_role() == Atspi.Role.FRAME:
                    frames.append(screen_extents(window))
                for node in descendants(window):
                    if node.get_role() != Atspi.Role.DIALOG:
                        continue
                    states = node.get_state_set()
                    visible = states.contains(Atspi.StateType.VISIBLE)
                    showing = states.contains(Atspi.StateType.SHOWING)
                    if node.get_name() in ("Recent download history", "Downloads"):
                        bounds = screen_extents(node)
                        observed.append({"name": node.get_name(), "visible": visible,
                                         "showing": showing, "bounds": bounds})
                        if visible and showing:
                            dialogs.append(bounds)
                    elif visible and showing:
                        other_dialogs.append(node.get_name())
        if owned and not dialogs:
            if absent_since is None:
                absent_since = time.monotonic()
            if time.monotonic() - absent_since >= 0.5:
                print(json.dumps({"pid": pid, "action": "dismiss-downloads", "clicks": clicks,
                                  "remainingNativeDialogs": observed}))
                return
        else:
            absent_since = None
        if dialogs and not clicks:
            if other_dialogs:
                raise RuntimeError("Refusing download dismissal while another native dialog is showing: "
                                   + json.dumps(other_dialogs))
            frame = next((bounds for bounds in frames if contains_point(bounds, point)), None)
            if frame is None:
                raise RuntimeError("Heading point is outside the owned visible browser frame: "
                                   + json.dumps({"point": point, "frames": frames}))
            if any(bounds is None or bounds["width"] <= 0 or bounds["height"] <= 0 for bounds in dialogs):
                raise RuntimeError("A visible download popup has unavailable native screen bounds")
            if any(contains_point(bounds, point) for bounds in dialogs):
                raise RuntimeError("Heading point overlaps an owned native download popup")
            if not Atspi.generate_mouse_event(point["x"], point["y"], "b1c"):
                raise RuntimeError("Native outside click could not be delivered")
            clicks.append({"event": "b1c", "point": point, "frame": frame, "dialogs": observed})
        time.sleep(0.1)
    raise RuntimeError("The owned native download popup did not disappear. " + json.dumps({
        "pid": pid, "point": point, "nativeDialogs": observed, "clicks": clicks
    }))


def main():
    """Find this fixture's browser process and operate the explicitly requested control."""
    pid = int(sys.argv[1])
    mode = sys.argv[2]
    if mode not in ("allow", "deny", "dismiss-downloads"):
        raise ValueError("Unknown native browser action: " + mode)
    initialized = Atspi.init()
    if initialized not in (0, 1):
        raise RuntimeError("AT-SPI could not initialize; run under the configured D-Bus and Xvfb session")
    if mode == "dismiss-downloads":
        dismiss_downloads(pid, json.loads(sys.argv[3]))
        return
    allow = mode == "allow"
    deadline = time.monotonic() + 15
    observed = []
    applications = []
    while time.monotonic() < deadline:
        context = GLib.MainContext.default()
        while context.pending():
            context.iteration(False)
        desktop = Atspi.get_desktop(0)
        applications = []
        for index in range(desktop.get_child_count()):
            application = desktop.get_child_at_index(index)
            applications.append({"pid": application.get_process_id(), "name": application.get_name()})
            if application.get_process_id() != pid:
                continue
            for window_index in range(application.get_child_count()):
                window = application.get_child_at_index(window_index)
                nodes = descendants(window)
                observed = [
                    {"role": node.get_role_name(), "name": node.get_name()}
                    for node in nodes
                ]
                text = " ".join(node.get_name() or "" for node in nodes)
                if "TOCus" not in text:
                    continue
                buttons = [node for node in nodes if node.get_role() == Atspi.Role.PUSH_BUTTON]
                accept = next((node for node in buttons if node.get_name() == "Allow"), None)
                reject = next((node for node in buttons if node.get_name() in ("Cancel", "Deny")), None)
                if accept is None or reject is None:
                    continue
                required_states = (Atspi.StateType.ENABLED, Atspi.StateType.VISIBLE, Atspi.StateType.SHOWING)
                if not all(node.get_state_set().contains(state) for node in (accept, reject) for state in required_states):
                    continue
                selected = accept if allow else reject
                decision = selected.get_name()
                labels = [node.get_name() for node in buttons]
                action = selected.get_action_iface()
                if action is None or action.get_n_actions() == 0 or not action.do_action(0):
                    raise RuntimeError("The native permission button refused its AT-SPI action")
                print(json.dumps({"pid": pid, "decision": decision, "text": text, "buttons": labels}))
                return
        time.sleep(0.1)
    raise RuntimeError("No enabled native TOCus permission dialog was found. " + json.dumps({
        "pid": pid, "applications": applications, "nativeControls": observed
    }))


if __name__ == "__main__":
    main()
