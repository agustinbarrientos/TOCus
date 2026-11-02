# Security

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/agustinbarrientos/TOCus/security/advisories/new), not public issues.

Include the affected version and browser, reproduction steps, and potential impact. Remove credentials, private URLs, and personal data from attachments.

Fixes target the latest code on `main`. This volunteer project cannot promise a response time; remediation and disclosure are coordinated through the advisory.

Use [GitHub issues](https://github.com/agustinbarrientos/TOCus/issues/new/choose) for ordinary bugs and feature requests.

## Dependency audits

Run `pnpm audit:dependencies` for the required high-severity dependency audit. CI uses the same command. The audit includes development and production dependencies, applies no advisory exceptions, and fails on high-severity findings or registry errors.

The former Braces exception was removed after GitHub [withdrew GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) on 2026-10-23 because it was not practically exploitable. No audit suppression or expiry override is needed. Dependency maintenance is tracked in [issue #61](https://github.com/agustinbarrientos/TOCus/issues/61).
