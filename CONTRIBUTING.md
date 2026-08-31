# Contributing to TOCus

Thanks for helping build TOCus. The project is early in development, so focused bug reports, design feedback, documentation, tests, and implementation work are all valuable.

## Before you start

- Search the existing issues and pull requests before opening a duplicate.
- Open an issue before a substantial behavior or architecture change so the direction can be discussed.
- Follow [SECURITY.md](SECURITY.md) for suspected vulnerabilities. Never put vulnerability details in a public issue.

## Development setup

Use Node.js 24.16.0 or newer within the Node.js 24 release line and pnpm 11.24.0, then install the locked dependencies. The `.node-version` file pins the 24.20.0 version used in CI.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup:browsers
```

See [README.md](README.md) for the available workspace scripts.

## Branches

Name branches with this pattern:

```text
agus/(enhancement|chore|fix|feature)/*
```

Choose one category and replace `*` with a short kebab-case name. The parentheses and pipe characters describe the allowed choices and are not part of the branch name.

- `enhancement`: improve existing behavior
- `chore`: maintenance, documentation, or tooling
- `fix`: correct a defect
- `feature`: add new user-facing behavior

For example, a maintainer foundation branch is `agus/chore/project-foundation`.

## Make a focused change

- Keep the change as small as practical and avoid unrelated refactors.
- Develop behavioral changes test-first: write or update a failing test before implementation, then make it pass.
- Preserve the categorical v1 privacy contract: local-only operation, no account or TOCus server, no telemetry or product analytics, no browsing-history permission or analysis, and no network requests for core operation. Explain and narrowly scope any browser permission or local storage change.
- Use accessible, gentle, and non-judgmental language.
- Do not describe TOCus as diagnosing, preventing, or treating OCD or another medical condition.
- Do not commit disposable generated output such as `.output`, `dist`, coverage, reports, or caches. Reviewed visual-regression baselines are test fixtures and are the only current exception.
- Do not hard-wrap prose, comments, or commit-message paragraphs in the middle of a sentence.
- Keep authored source and documentation files ASCII-only. Use HTML entities when an intentional rendered glyph or accent is required.

## Validate your work

Before opening a pull request, run:

```sh
pnpm check
```

If a check cannot run in your environment, explain why in the pull request.

## Open a pull request

Use the pull request template and include:

- what changed and why;
- the related issue, when one exists;
- how the change was validated;
- screenshots or recordings only for visual changes; and
- privacy, permissions, accessibility, or wellbeing implications.

Keep follow-up changes within the original scope when possible, and open a separate issue for unrelated work.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
