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
- Added local-only statistics for estimated time reclaimed, focused pause time, reconsidered visits, completed waits, and allowances granted, with all-time interruption summaries and a reset that leaves protection settings untouched.
- Added the initial project website, contribution guidance, and public project documentation.

### Changed

- Increased shared typography sizes by 25%, clarified selected appearance controls, and widened the floating breathing preview to a desktop aspect ratio.

### Fixed

- Transformed component decorators in production bundles and validated generated JavaScript syntax for Chrome, Firefox, and Safari.
- Preserved soft outlines, translucent surfaces, and gradients when an explicit theme and color palette are selected.
