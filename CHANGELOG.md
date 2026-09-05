# Changelog

All notable changes to TOCus will be documented in this file.

## 0.1.0 - Alpha

_In development._

### Added

- Established the initial Chrome, Firefox, and Safari extension foundation with WXT and Lit.
- Kept the extension local-first with no saved-history access or telemetry, exact site access requested only when protection is enabled, and an explicit no-data declaration for Firefox.
- Added the localized toolbar popup with current-website status, one-click website setup, active timing scopes, allowance and next-wait information, local cached favicons where supported, and links to Settings and Statistics.
- Added the shared theme, six color palettes, bundled Fredoka brand typography, and semantic typography roles.
- Added build-contract, accessibility, local visual-regression, and cross-browser build checks.
- Added the local protection-domain foundation for protected sites, schedules, daily wait progression, breathing plans, focus-aware shared waits, wall-clock allowances, warning decisions, metric facts, and restart-safe restoration.
- Added browser-backed protection restoration with serialized local and session persistence.
- Added the local protected-site identity and configuration foundation with editable names, a top-site display-name catalog, deterministic monogram fallbacks, and a cache-only favicon provider for supported browsers.
- Added local protected-site settings for adding, editing, grouping, and removing sites, with cached Chrome favicons and monogram fallbacks for Firefox and Safari.
- Added the accessible full-screen breathing pause and Ready presentation with natural motion, focus-aware timing, and local light and dark visual baselines.
- Added live Chrome, Firefox, and Safari navigation protection with shared waits, wall-clock allowances, restart recovery, and non-destructive gentle re-interruption.
- Added generated browser icons and global toolbar badges for active wait, allowance, and multiple-scope status.
- Added local appearance and accessibility preferences for system, light, and dark themes, six full-scene palettes, Breathing and Quiet pause presentation, and user or operating-system reduced motion across extension surfaces.
- Added fully local interface translations across the extension and website for English, two Spanish variants, two Portuguese variants, Italian, French, German, Japanese, and Russian, with one canonical catalog per language, automatic browser-language detection, and an explicit Language setting.
- Added first-install language, appearance, and website setup with local draft selections, a removable website list, bundled suggestion icons, and one permission request for the selected websites when setup finishes.
- Added clickable onboarding steps with completed checkmarks and retained choices when revisiting earlier steps.
- Added local-only statistics for estimated time reclaimed, focused pause time, reconsidered visits, completed waits, and allowances granted, with all-time interruption summaries and a reset that leaves protection settings untouched.
- Added the initial project website, contribution guidance, and public project documentation.

### Changed

- Increased full-page typography sizes by 15% while keeping the toolbar popup compact, clarified selected appearance controls, and widened the floating breathing preview to a desktop aspect ratio.
- Simplified onboarding privacy copy and increased paragraph line spacing.

### Fixed

- Transformed component decorators in production bundles and validated generated JavaScript syntax for Chrome, Firefox, and Safari.
- Preserved soft outlines, translucent surfaces, and gradients when an explicit theme and color palette are selected.
- Matched extension-page tab icons to the browser's light or dark appearance independently of the selected interface theme.
- Kept Chrome popup website additions running in the background when the permission dialog closes the popup, without saving denied requests.
- Sent whole-millisecond pause checkpoints while preserving smooth animation timing, preventing fractional progress from breaking pauses and recovery.
- Identified redacted interruption tabs through live extension contexts so pauses can preserve their destination and Continue can restore website access without the tabs permission.
- Ignored delayed navigation events that no longer describe the current page, preventing an old blank tab from dismissing a new pause.
- Initialized the protected-page interface in Chrome's isolated script environment with bundled Custom Elements support.
- Kept rem-based typography from applying the size increase twice on extension pages.
