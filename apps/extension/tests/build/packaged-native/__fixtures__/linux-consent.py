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


def download_focus_nodes(element, depth=0):
    """Inspect focus only inside an already verified native Downloads dialog, including its WebUI."""
    if depth > 25:
        return []
    nodes = [element]
    for index in range(element.get_child_count()):
        child = element.get_child_at_index(index)
        if child is not None:
            nodes.extend(download_focus_nodes(child, depth + 1))
    return nodes


def dismiss_downloads(pid):
    """Close only the owned download dialog, then verify native chrome is clear."""
    deadline = time.monotonic() + 15
    absent_since = None
    dismissed = []
    observed = []
    focused_downloads = False
    escaped_downloads = False
    required_states = (Atspi.StateType.ENABLED, Atspi.StateType.VISIBLE, Atspi.StateType.SHOWING)
    while time.monotonic() < deadline:
        context = GLib.MainContext.default()
        while context.pending():
            context.iteration(False)
        desktop = Atspi.get_desktop(0)
        owned = False
        dialogs = []
        other_dialogs = []
        for index in range(desktop.get_child_count()):
            application = desktop.get_child_at_index(index)
            if application.get_process_id() != pid:
                continue
            owned = True
            for window_index in range(application.get_child_count()):
                nodes = descendants(application.get_child_at_index(window_index))
                for node in nodes:
                    if (node.get_role() != Atspi.Role.DIALOG
                            or not node.get_state_set().contains(Atspi.StateType.SHOWING)):
                        continue
                    if node.get_name() in ("Recent download history", "Downloads"):
                        dialogs.append(node)
                    else:
                        other_dialogs.append(node)
        if owned and not dialogs:
            if absent_since is None:
                absent_since = time.monotonic()
            if time.monotonic() - absent_since >= 0.5:
                print(json.dumps({"pid": pid, "action": "dismiss-downloads", "dismissed": dismissed}))
                return
        else:
            absent_since = None
        for dialog in dialogs:
            nodes = descendants(dialog)
            observed = [{"role": node.get_role_name(), "name": node.get_name()} for node in nodes]
            close = next((node for node in nodes
                          if node.get_role() == Atspi.Role.PUSH_BUTTON and node.get_name() == "Close"
                          and all(node.get_state_set().contains(state) for state in required_states)), None)
            if close is None:
                if dialog.get_name() != "Downloads" or escaped_downloads:
                    continue
                if other_dialogs:
                    raise RuntimeError("Refusing download Escape while another owned native dialog is showing")
                focus_nodes = download_focus_nodes(dialog)
                focused = next((node for node in focus_nodes
                                if node.get_state_set().contains(Atspi.StateType.FOCUSED)), None)
                if not focused_downloads:
                    if focused is None:
                        candidates = [dialog] + [node for node in focus_nodes[1:]
                                                 if node.get_state_set().contains(Atspi.StateType.FOCUSABLE)
                                                 and all(node.get_state_set().contains(state)
                                                         for state in required_states)]
                        for candidate in candidates:
                            component = candidate.get_component_iface()
                            if component is not None and component.grab_focus():
                                break
                        else:
                            raise RuntimeError("The owned Downloads dialog refused native keyboard focus")
                    focused_downloads = True
                    continue
                if focused is None:
                    continue
                # Native keyboard synthesis is safe only after focus is verified inside this exact owned dialog.
                if not Atspi.generate_keyboard_event(0xFF1B, None, Atspi.KeySynthType.SYM):
                    raise RuntimeError("Native Escape could not be delivered to the focused Downloads dialog")
                escaped_downloads = True
                dismissed.append({"dialog": "Downloads", "key": "Escape", "focusedRole": focused.get_role_name()})
                continue
            action = close.get_action_iface()
            if action is None or action.get_n_actions() == 0 or not action.do_action(0):
                raise RuntimeError("The native download dialog Close button refused its AT-SPI action")
            dismissed.append({"dialog": dialog.get_name(), "button": "Close"})
        time.sleep(0.1)
    raise RuntimeError("The owned native download dialog did not close. " + json.dumps({
        "pid": pid, "nativeControls": observed, "dismissed": dismissed
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
        dismiss_downloads(pid)
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
