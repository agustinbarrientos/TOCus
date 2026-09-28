#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Linux ]]; then
	printf 'This command requires Linux. Use CI or a Linux VM for unattended native permission tests.\n' >&2
	exit 1
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"
environment_file="$repository_root/test-results/installed-browser-setup/environment.sh"
if [[ ! -f "$environment_file" ]]; then
	printf 'Run pnpm setup:installed-browsers first.\n' >&2
	exit 1
fi
source "$environment_file"

export NO_AT_BRIDGE=0
export GTK_MODULES="${GTK_MODULES:+$GTK_MODULES:}gail:atk-bridge"
/usr/bin/python3 -c 'import gi; gi.require_version("Atspi", "2.0"); from gi.repository import Atspi'
exec dbus-run-session -- xvfb-run -a pnpm test:installed-extension "$@"
