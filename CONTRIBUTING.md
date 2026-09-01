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
<username>/(enhancement|chore|fix|feature)/*
```

Replace `<username>` with your GitHub username, choose one category, and replace `*` with a short kebab-case name. The angle brackets, parentheses, and pipe characters describe placeholders or allowed choices and are not part of the branch name.

- `enhancement`: improve existing behavior
- `chore`: maintenance, documentation, or tooling
- `fix`: correct a defect
- `feature`: add new user-facing behavior

For example, a contributor named Sam could use `sam/feature/local-schedules`.

## Make a focused change

- Keep the change as small as practical and avoid unrelated refactors.
- Develop behavioral changes test-first: write or update a failing test before implementation, then make it pass.
- Keep business rules inside their domain and keep feature folders focused on user-interface composition.
- Within a domain, place shared contracts in `types`, pure behavior in `utils`, browser or external I/O in `services`, and rendered elements in `components`.
- Keep each domain contract in a focused direct file under `types`, use nested type groups only for genuinely related multi-file contracts, and place reusable test data under `types/__fixtures__`.
- Give each utility or service leaf folder one cohesive responsibility and colocate its `index.ts`, required `index.test.ts`, and optional `types.ts`.
- Give each component leaf folder one cohesive responsibility and colocate its `index.ts` and `index.wtr.test.ts`; add `visual.wtr.test.ts` when the component is styled, and add `index.test.ts` only for independently testable pure logic or types.
- Preserve the categorical v1 privacy contract: local-only operation, no account or TOCus server, no telemetry or product analytics, no browsing-history permission or analysis, and no network requests for core operation. Explain and narrowly scope any browser permission or local storage change.
- Use accessible, gentle, and non-judgmental language.
- Do not describe TOCus as diagnosing, preventing, or treating OCD or another medical condition.
- Do not commit disposable generated output such as `.output`, `dist`, coverage, reports, or caches. Reviewed visual-regression baselines are test fixtures and are the only current exception.
- Do not hard-wrap prose, comments, or commit-message paragraphs in the middle of a sentence.
- Document every declared type, schema, named function, assigned function, and method with TSDoc or JSDoc. Add an appropriate `@since` tag to every exported declaration.
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
