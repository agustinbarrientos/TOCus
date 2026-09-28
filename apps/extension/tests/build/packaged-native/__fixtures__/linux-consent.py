"""Choose a real browser permission button through the desktop AT-SPI service."""

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


def main():
    """Find this fixture's browser process and activate its native consent button."""
    pid = int(sys.argv[1])
    allow = sys.argv[2] == "allow"
    initialized = Atspi.init()
    if initialized not in (0, 1):
        raise RuntimeError("AT-SPI could not initialize; run under the configured D-Bus and Xvfb session")
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
