<div align="center">

<img src="./packages/theme/assets/logo.svg" alt="TOCus" width="230" />

### A gentle pause before distracting websites

TOCus is an extension that gives you a short breathing pause before loading the websites you choose as distracting, so you can notice the impulse and decide what to do next.

<!-- <img src="./.github/assets/download-for-chrome.svg" alt="Download for Chrome" height="52" /> <img src="./.github/assets/download-for-firefox.svg" alt="Download for Firefox" height="52" /> <img src="./.github/assets/download-for-safari.svg" alt="Download for Safari" height="52" /> -->

</div>

---

[![CI](https://github.com/agustinbarrientos/TOCus/actions/workflows/ci.yml/badge.svg)](https://github.com/agustinbarrientos/TOCus/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

TOCus is a free and open-source browser extension that adds a gentle breathing pause before websites you choose as distracting. The goal is to create a small moment to notice an impulse and decide what to do next, not to block, shame, or judge.

> **Important:** TOCus is a wellbeing tool, not medical treatment. It doesn't diagnose OCD or any other condition, and it makes no clinical promises.

## How it works

1. Choose the websites where you want a pause.
2. When you visit one, TOCus offers a brief, calm breathing moment.
3. After the pause, decide for yourself whether to continue.

## Privacy

TOCus is and will remain local-only, with no account, TOCus server, cloud backup or synchronization, telemetry, or product analytics. Selected-site settings and pause interactions stay on your device. The extension makes no external network requests and does not access your browser's saved history. Opening the toolbar popup gives TOCus temporary access to the active tab so it can show or add that website; it does not grant ongoing access to other tabs. Browsers may describe the optional permission used to observe current navigation as access to browsing history; TOCus requests it only when you protect a site and does not retain or transmit a browsing history. This commitment covers the extension's own traffic; websites, the browser, and external pages you choose to open generate their own traffic.

Settings includes **Privacy and local data**, where you can review local storage and browser permissions. Reset statistics keeps your websites and preferences. Reset all TOCus data removes your choices and statistics, revokes website access, and reopens setup after confirmation. A non-personal reset marker remains locally to prevent older pages from restoring deleted data.

## Stack

- [WXT](https://wxt.dev/) and [React](https://react.dev/) for the browser extension
- [Mantine](https://mantine.dev/) with shared TOCus theme tokens for controls across the extension and website
- [Astro](https://astro.build/) with React islands for the project website
- pnpm workspaces and [Turborepo](https://turbo.build/repo)
- TypeScript, Vitest, and ESLint

## Prerequisites

- Node.js 24.16.0 or newer within the Node.js 24 release line (`.node-version` pins the 24.20.0 version used in CI)
- pnpm 11.24.0

The repository pins its package-manager version in `package.json`.

## Setup

```sh
git clone https://github.com/agustinbarrientos/TOCus.git
cd TOCus
corepack enable
pnpm install --frozen-lockfile
pnpm setup:browsers
```

Start the workspace development tasks:

```sh
pnpm dev
```

## Useful scripts

| Command                                | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                             | Run workspace development tasks in parallel                 |
| `pnpm setup:browsers`                  | Install pinned Chromium, Firefox and WebKit builds          |
| `pnpm build`                           | Build all workspaces                                        |
| `pnpm build:firefox`                   | Build the extension for Firefox                             |
| `pnpm build:safari`                    | Build the extension for Safari                              |
| `pnpm lint`                            | Run script and stylesheet linting                           |
| `pnpm lint:fix`                        | Fix autofixable script and stylesheet issues                |
| `pnpm typecheck`                       | Type-check all workspaces                                   |
| `pnpm test`                            | Run unit coverage, build-contract, and browser tests        |
| `pnpm test:unit`                       | Run unit tests with protection coverage thresholds          |
| `pnpm test:build-contract`             | Build all browser targets and validate generated artifacts  |
| `pnpm test:browser`                    | Run native media/Canvas coverage and all presentation tests |
| `pnpm test:ui`                         | Run shared controls and extension UI in all three engines  |
| `pnpm check`                           | Run linting, type checks, and tests                         |

## Repository structure

```text
.
|-- apps/
|   |-- extension/       # WXT + React browser extension and extension-owned tests
|   `-- website/         # Astro website with React islands
|-- packages/
|   |-- theme/           # Shared icons and design tokens
|   `-- ui/              # Shared Mantine theme, provider and UI compositions
`-- eslint.config.js     # Repository lint configuration
```

## Contributing

Contributions are welcome while the project is young. Read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, quality checks, and pull request guidance.

Please report suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## License

TOCus is available under the [MIT License](LICENSE).
