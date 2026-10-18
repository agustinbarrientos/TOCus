# Security

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/agustinbarrientos/TOCus/security/advisories/new), not public issues.

Include the affected version and browser, reproduction steps, and potential impact. Remove credentials, private URLs, and personal data from attachments.

Fixes target the latest code on `main`. This volunteer project cannot promise a response time; remediation and disclosure are coordinated through the advisory.

Use [GitHub issues](https://github.com/agustinbarrientos/TOCus/issues/new/choose) for ordinary bugs and feature requests.

## Dependency audits

Run `pnpm audit:dependencies` for the required high-severity dependency audit. CI uses the same command. It checks the temporary exception below against the effective pnpm settings and complete recursive production lockfile graph before invoking the native audit. Other high-severity findings remain blocking, and pnpm reports the accepted advisory as ignored rather than clean.

### Temporary Braces exception

- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affecting `braces` through 3.0.3.
- Owner: [agustinbarrientos](https://github.com/agustinbarrientos).
- Approved: 2026-10-17.
- Review due: 2026-10-31 at 00:00 America/Bogota (05:00 UTC). The guarded command fails on or after this deadline; renewal requires another explicit risk review.
- Scope: development tools only, currently reached through Lingui, Stylelint, and the browser test runner via Micromatch. The recursive production lockfile graph contains no Braces dependency.
- Rationale: the affected walkers process patterns defined by this repository. No path from websites or extension users to those patterns was found. The failure requires deeply nested patterns; no fixed upstream release is available. This is a reviewed risk acceptance, not a claim that Braces has been patched or the advisory withdrawn.

The guard rejects any Braces dependency in the production graph, including optional dependencies and aliases, and requires the exact approved advisory as the only ignored finding. An unavailable or malformed dependency graph fails the check. Raw `pnpm audit` reads the static ignore list without these guards, so use the documented guarded command for required validation.

When a verified upstream fix is installed after the two-day release cooldown, or Braces is removed from the dependency graph, remove the exact ignore entry and exception-specific guard and tests together; retain the native high-severity audit in CI. Review the exception earlier if its input paths, dependency scope, or upstream advisory status changes. Dependency maintenance is tracked in [issue #61](https://github.com/agustinbarrientos/TOCus/issues/61).
