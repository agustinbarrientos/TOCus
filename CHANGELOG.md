# Changelog

## 1.1.0 - Unreleased

- Added: Restore a local backup during onboarding from the Have a backup? header action, with file review and recovery for missing website access (Chrome, Edge, Firefox).

- Changed: Labeled buttons share proportional icon sizing and consistent spacing in the extension and website (Chrome, Edge, Firefox).

- Added: Add comma-separated website addresses together, with comma-separated placeholder examples, a localized Add sites action, complete input validation, and duplicate-safe staging that preserves existing policies and default exceptions (Chrome, Edge, Firefox).

- Fixed: Paths beneath a No pause website use global timing and schedules unless they have their own overrides. Paused paths prefer their own host's parent settings, including product subdomains, and switching the parent back to Pause restores its saved overrides (Chrome, Edge, Firefox).

- Added: Adding a website path before its domain creates an editable No pause domain entry while keeping the path paused, using the same behavior across Settings, popup and onboarding. Onboarding preserves full paths and keeps sibling entries independent (Chrome, Edge, Firefox).

- Added: Main websites can use No pause while selected paths or subdomains keep their own pauses (Chrome, Edge, Firefox).

- Fixed: No-pause website rules hide custom schedule controls and tags, retain valid schedule preferences, and save successfully when hidden schedule fields are unfinished (Chrome, Edge, Firefox).

- Fixed: Unprotected grouping headings show No pause, and recognized product subdomains have independent website rows, product names and isolated cached icons while preserving custom names and saved protection rules (Chrome, Edge, Firefox).

- Changed: Website address placeholders show separate domain, subdomain and path examples in Settings and onboarding (Chrome, Edge, Firefox).

- Fixed: Destructive outline buttons use a red border matching their label, including Remove selected, Clear all and Discard (Chrome, Edge, Firefox).

- Added: Grouped website path and subdomain exceptions, with independent schedules, complete custom pause timing for websites and exceptions, inline override tags beside website addresses, and an explicit no-pause option. Select individual exceptions or their whole website group, and newly added YouTube rules include an editable no-pause exception for YouTube Studio. Shared pauses keep elapsed progress when a longer rule joins, and backups preserve all overrides (Chrome, Edge, Firefox).

- Fixed: Search-result links containing text fragments restore their breathing pause and keep the complete destination when continuing, including after retrying a temporary restoration failure (Chrome, Edge, Firefox).
- Added: Live breathing-screen previews in Quick links and Appearance that share onboarding's browser frame, float at the bottom right, reflect unsaved changes, respect reduced motion, and stay separate from real pause activity (Chrome, Edge, Firefox).
- Added: Optional Statistics comparisons for the current week, month and year, with matched elapsed dates, neutral trend tags, dashed previous-period charts and an all-websites outcome summary. Comparisons use existing local history and stay hidden when recording coverage is insufficient (Chrome, Edge, Firefox).
- Fixed: Websites and Statistics display cached favicons when the browser's local image response omits its content type (Chrome, Edge).
- Fixed: Switch labels stay vertically centered beside their toggles, including the Statistics comparison control (Chrome, Edge, Firefox).
- Fixed: The website hero keeps a stable height when mobile browser controls expand or collapse, preserving the shoreline transition (mobile Chrome, Edge, Firefox, Safari).
- Changed: Redesigned Statistics around the current week, with selectable daily activity, website visit outcomes, consistent saved website icons and names, readable hourly tooltip times, explicit empty states, and left-aligned mobile outcome legends. New breakdowns stay on the device, are included in backups, and start from the upgrade without reconstructing earlier history (Chrome, Edge, Firefox).
- Fixed: Enlarging Settings text no longer doubles the page's minimum width on narrow screens (Chrome, Edge, Firefox).
- Fixed: Websites and Statistics try cached HTTP, HTTPS, www and non-www icon variants before showing the local monogram (Chrome, Edge).

- Added: Up to three optional quick links on both pause screens, managed in Quick links below Schedule in Settings using compact website rows and add/edit dialogs, with keyboard reorder controls and backup support. Shortcuts preserve the breathing artwork's original size and appear without an extra heading (Chrome, Edge, Firefox).

- Added: Local JSON backup and restore for website rules, schedules, preferences, and statistics, with a dedicated Backup and reset settings page (Chrome, Edge, Firefox).
- Changed: Updated the Sass compiler to 1.105.2 and refreshed pinned CI setup and artifact actions (Chrome, Edge, Firefox).
- Changed: Updated application and development dependencies with a two-day release cooldown while keeping TypeScript 6.0.3 (Chrome, Edge, Firefox).
- Changed: Added a reviewed development-tool audit exception with an enforced review deadline and production dependency check.

## 1.0.1 - 2026-09-28

- Fixed: Navigation loops that prevented websites from opening after Continue (Firefox).
- Fixed: Missing on-page pauses when browsing time expires (Firefox).
- Fixed: Incomplete data resets after browser permissions are removed (Firefox).
- Fixed: Toolbar popup sizing that hid its controls (Chrome, Edge, Firefox).
- Fixed: Incorrect website access status after permission removal (Chrome, Edge, Firefox).

## 1.0.0 - 2026-09-25

First public release of TOCus for desktop Chrome, Microsoft Edge, and Firefox.

- Added: Breathing pauses before selected websites, with customizable pause and browsing times.
- Added: Active hours and separate schedules for individual websites.
- Added: Automatic video pausing during a breathing pause.
- Added: A toolbar popup for adding websites and checking their current status.
- Added: Local statistics for completed pauses, reconsidered visits, and estimated time saved.
- Added: Six colors, light and dark themes, optional breathing guidance, and support for the system's reduced-motion preference.
- Added: Guided setup and settings in ten languages and language variants.
- Added: Controls to review website permissions, reset statistics, and remove local data.
- Added: Offline operation with no accounts, ads, or tracking.
