"""Exercise native consent traversal without requiring a desktop accessibility service."""

import importlib.util
import io
import json
import sys
import types
import unittest
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch


def load_consent_module():
    """Load the real helper with only its platform bindings replaced."""
    gi = types.ModuleType("gi")
    gi.require_version = Mock()
    repository = types.ModuleType("gi.repository")
    repository.Atspi = types.SimpleNamespace(
        Role=types.SimpleNamespace(DOCUMENT_WEB="web", PUSH_BUTTON="button"),
        StateType=types.SimpleNamespace(ENABLED="enabled", VISIBLE="visible", SHOWING="showing"),
    )
    repository.GLib = types.SimpleNamespace(
        MainContext=types.SimpleNamespace(default=lambda: types.SimpleNamespace(pending=lambda: False)),
    )
    spec = importlib.util.spec_from_file_location(
        "native_consent_under_test", Path(__file__).with_name("linux-consent.py")
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"gi": gi, "gi.repository": repository}):
        spec.loader.exec_module(module)
    return module


consent = load_consent_module()


class Accessible:
    """Model an accessibility node, including children removed during enumeration."""

    def __init__(self, role="frame", name="", children=(), states=(), action=None):
        self.role = role
        self.name = name
        self.children = list(children)
        self.states = states
        self.action = action

    def get_role(self):
        return self.role

    def get_role_name(self):
        return self.role

    def get_name(self):
        return self.name

    def get_child_count(self):
        return len(self.children)

    def get_child_at_index(self, index):
        return self.children[index]

    def get_process_id(self):
        return 123

    def get_state_set(self):
        return types.SimpleNamespace(contains=lambda state: state in self.states)

    def get_action_iface(self):
        return self.action


class LinuxConsentTests(unittest.TestCase):
    def test_missing_window_has_no_descendants(self):
        self.assertEqual(consent.descendants(None), [])

    def test_native_buttons_survive_missing_children(self):
        allow = Accessible(role="button", name="Allow")
        deny = Accessible(role="button", name="Deny")
        dialog = Accessible(name="TOCus", children=[None, allow, None, deny])
        window = Accessible(children=[None, dialog])
        self.assertEqual(consent.descendants(window), [window, dialog, allow, deny])

    def test_web_document_cannot_supply_native_consent_controls(self):
        webpage = Accessible(role="web", name="TOCus", children=[
            Accessible(role="button", name="Allow"), Accessible(role="button", name="Deny"),
        ])
        native_label = Accessible(name="Browser")
        window = Accessible(children=[webpage, native_label])
        self.assertEqual(consent.descendants(webpage), [])
        self.assertEqual(consent.descendants(window), [window, native_label])

    def test_depth_limit_keeps_boundary_node_and_excludes_deeper_children(self):
        child = Accessible(role="button", name="Allow")
        boundary = Accessible(children=[child])
        self.assertEqual(consent.descendants(boundary, 25), [boundary])
        self.assertEqual(consent.descendants(boundary, 26), [])

    def run_main(self, window, decision):
        """Run the real consent selection against a bounded synthetic desktop."""
        application = Accessible(name="Browser", children=[None, window])
        desktop = Accessible(children=[application])
        output = io.StringIO()
        with ExitStack() as stack:
            stack.enter_context(patch.object(consent.Atspi, "init", return_value=0, create=True))
            stack.enter_context(patch.object(consent.Atspi, "get_desktop", return_value=desktop, create=True))
            stack.enter_context(patch.object(consent.sys, "argv", ["linux-consent.py", "123", decision]))
            stack.enter_context(patch.object(consent.time, "monotonic", side_effect=[0, 1, 16]))
            stack.enter_context(patch.object(consent.time, "sleep"))
            stack.enter_context(redirect_stdout(output))
            consent.main()
        return json.loads(output.getvalue())

    def test_missing_window_does_not_prevent_actual_allow_or_deny_selection(self):
        for decision, reject_name in [("allow", "Cancel"), ("deny", "Cancel"), ("deny", "Deny")]:
            with self.subTest(decision=decision, reject_name=reject_name):
                allow_action = Mock(get_n_actions=Mock(return_value=1), do_action=Mock(return_value=True))
                reject_action = Mock(get_n_actions=Mock(return_value=1), do_action=Mock(return_value=True))
                states = {"enabled", "visible", "showing"}
                allow = Accessible(role="button", name="Allow", states=states, action=allow_action)
                reject = Accessible(role="button", name=reject_name, states=states, action=reject_action)
                window = Accessible(name="TOCus permission", children=[allow, reject])
                result = self.run_main(window, decision)
                self.assertEqual(result["pid"], 123)
                self.assertEqual(result["decision"], "Allow" if decision == "allow" else reject_name)
                self.assertEqual(result["buttons"], ["Allow", reject_name])
                selected = allow_action if decision == "allow" else reject_action
                unselected = reject_action if decision == "allow" else allow_action
                selected.do_action.assert_called_once_with(0)
                unselected.do_action.assert_not_called()

    def test_both_native_buttons_still_require_enabled_visible_and_showing(self):
        for missing_state in ["enabled", "visible", "showing"]:
            with self.subTest(missing_state=missing_state):
                action = Mock(get_n_actions=Mock(return_value=1), do_action=Mock(return_value=True))
                allow = Accessible(role="button", name="Allow", states={"enabled", "visible", "showing"}, action=action)
                reject = Accessible(role="button", name="Deny", states={"enabled", "visible", "showing"} - {missing_state}, action=action)
                window = Accessible(name="TOCus permission", children=[allow, reject])
                with self.assertRaisesRegex(RuntimeError, "No enabled native TOCus permission dialog"):
                    self.run_main(window, "allow")
                action.do_action.assert_not_called()


if __name__ == "__main__":
    unittest.main()
