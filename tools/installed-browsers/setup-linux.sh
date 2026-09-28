#!/usr/bin/env bash
set -euo pipefail

# Install only official products on Ubuntu/Debian x86_64, without using a personal browser profile.
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
	printf 'Installed-browser setup requires Linux x86_64.\n' >&2
	exit 1
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"
products=("$@")
if [[ ${#products[@]} -eq 0 ]]; then
	products=(chrome edge firefox)
fi
for product in "${products[@]}"; do
	case "$product" in
		chrome|edge|firefox) ;;
		*) printf 'Unknown installed browser: %s\n' "$product" >&2; exit 1 ;;
	esac
done

sudo_command=()
if [[ "$(id -u)" -ne 0 ]]; then
	sudo_command=(sudo -n)
fi
"${sudo_command[@]}" apt-get update
"${sudo_command[@]}" apt-get install -y python3-gi gir1.2-atspi-2.0 at-spi2-core dbus-x11 xvfb xauth curl xz-utils libatk-adaptor libgail-common

setup_directory="$repository_root/test-results/installed-browser-setup"
mkdir -p "$setup_directory"
: > "$setup_directory/environment.sh"
: > "$setup_directory/versions.txt"

for product in "${products[@]}"; do
	case "$product" in
		chrome)
			pnpm exec playwright install --with-deps --force chrome
			executable=/opt/google/chrome/chrome
			variable=CHROME_EXECUTABLE_PATH
			;;
		edge)
			pnpm exec playwright install --with-deps --force msedge
			executable=/opt/microsoft/msedge/msedge
			variable=EDGE_EXECUTABLE_PATH
			;;
		firefox)
			pnpm exec playwright install-deps firefox
			firefox_version=156.0.1
			archive="firefox-$firefox_version.tar.xz"
			archive_path="linux-x86_64/en-US/$archive"
			release_url="https://archive.mozilla.org/pub/firefox/releases/$firefox_version"
			download_directory="$(mktemp -d)"
			trap 'rm -rf "$download_directory"' EXIT
			curl --fail --location --retry 3 "$release_url/$archive_path" -o "$download_directory/$archive"
			curl --fail --location --retry 3 "$release_url/SHA256SUMS" -o "$download_directory/SHA256SUMS"
			awk -v target="$archive_path" -v archive="$archive" '$2 == target { print $1 "  " archive }' \
				"$download_directory/SHA256SUMS" > "$download_directory/checksum"
			test -s "$download_directory/checksum"
			(cd "$download_directory" && sha256sum --check checksum)
			tar -xJf "$download_directory/$archive" -C "$download_directory"
			browser_cache="${XDG_CACHE_HOME:-$HOME/.cache}/tocus/installed-browsers"
			mkdir -p "$browser_cache"
			firefox_directory="$browser_cache/firefox-$firefox_version"
			rm -rf "$firefox_directory"
			mv "$download_directory/firefox" "$firefox_directory"
			executable="$firefox_directory/firefox"
			variable=FIREFOX_EXECUTABLE_PATH
			;;
	esac
	test -x "$executable"
	printf 'export %s=%q\n' "$variable" "$executable" >> "$setup_directory/environment.sh"
	printf '%s: %s\n' "$product" "$executable" | tee -a "$setup_directory/versions.txt"
	"$executable" --version | tee -a "$setup_directory/versions.txt"
done

printf 'Ready. Run pnpm test:installed-extension:linux after building the extension artifacts.\n'
