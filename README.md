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
- pnpm 12.5.1

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
| `pnpm build:edge`                      | Build the Edge Manifest V3 extension                        |
| `pnpm build:firefox`                   | Build the extension for Firefox                             |
| `pnpm build:safari`                    | Build Safari web-extension assets                           |
| `pnpm zip:chrome`                      | Build and ZIP the Chrome release                            |
| `pnpm zip:edge`                        | Build and ZIP the Edge release                              |
| `pnpm zip:firefox`                     | Build and ZIP the Firefox release                           |
| `pnpm zip:safari`                      | Build and ZIP Safari web-extension assets                   |
| `pnpm lint`                            | Run script and stylesheet linting                           |
| `pnpm lint:fix`                        | Fix autofixable script and stylesheet issues                |
| `pnpm typecheck`                       | Type-check all workspaces                                   |
| `pnpm test`                            | Run unit coverage, build-contract, and browser tests        |
| `pnpm test:unit`                       | Run unit tests with protection coverage thresholds          |
| `pnpm test:build-contract`             | Build all browser targets and validate generated artifacts  |
| `pnpm test:build-browser`              | Run isolated browser journeys against already-built files  |
| `pnpm test:browser`                    | Run native media/Canvas coverage and all presentation tests |
| `pnpm test:ui`                         | Run shared controls and extension UI in all three engines  |
| `pnpm check`                           | Run linting, type checks, and tests                         |

## Prepare a release

Use a clean checkout of the reviewed release commit, the Node.js version in `.node-version`, and the pinned pnpm version. Install dependencies with `pnpm install --frozen-lockfile`, then run `pnpm check` and `pnpm test:visual` in the supported environments described in [CONTRIBUTING.md](CONTRIBUTING.md). Record the commit, operating system and architecture, tool versions, check results, and artifact SHA-256 values with the release.

Create production archives from the repository root:

```sh
pnpm zip:chrome
pnpm zip:edge
pnpm zip:firefox
pnpm zip:safari
```

Each command uses [WXT's built-in ZIP command](https://wxt.dev/guide/essentials/publishing) to rebuild its target before archiving it. These commands create local files; store submission is a separate step. With extension version `0.1.0`, the outputs under `apps/extension/.output/` are:

| Archive | Manifest | Intended use |
| --- | --- | --- |
| `tocusextension-0.1.0-chrome.zip` | V3, Chrome 120+ | Chrome Web Store upload |
| `tocusextension-0.1.0-edge.zip` | V3, Chromium 120 compatibility floor | Microsoft Edge Add-ons upload after native verification |
| `tocusextension-0.1.0-firefox.zip` | V2, Firefox 140+ | Firefox Add-ons upload |
| `tocusextension-0.1.0-safari.zip` | V2, Safari 16.4+ | Input to Apple's Safari packaging workflow |

Verify ZIP integrity with `unzip -t`, inspect each archive's root `manifest.json` with `unzip -p`, and confirm the packaged icons, locale messages, page resources, and permissions match the reviewed build. For example:

```sh
unzip -t apps/extension/.output/tocusextension-0.1.0-firefox.zip
unzip -p apps/extension/.output/tocusextension-0.1.0-firefox.zip manifest.json
shasum -a 256 apps/extension/.output/tocusextension-0.1.0-chrome.zip apps/extension/.output/tocusextension-0.1.0-edge.zip apps/extension/.output/tocusextension-0.1.0-firefox.zip apps/extension/.output/tocusextension-0.1.0-safari.zip
```

Re-run `pnpm exec vitest run --config config/vitest.config.ts --project build-contract` for static artifact checks and `pnpm test:build-browser` for packaged browser journeys after packaging. Browser journeys run sequentially with no retries and retain traces and screenshots only on failure under `test-results/build-browser/`; their HTML report is under `playwright-report/build-browser/`. The separate `pnpm test:ui` command uses Playwright Test for shared controls and extension presentation, reusing one fixture server and worker-owned browsers with isolated test contexts. Its diagnostics are under `test-results/ui/` and `playwright-report/ui/`. CI uploads both suites' diagnostics on failure. Replace `0.1.0` in filenames when the extension version changes. The declared minimum browser versions are compatibility targets; successful builds do not establish runtime support across every version.

### Edge verification and publication

`pnpm build:edge` emits `apps/extension/.output/edge-mv3/` from the shared extension source. Edge and Chrome use the same popup enrollment path and browser-local cached-favicon capability. The Edge manifest retains optional website access and navigation permission, without adding access to saved history, required broad host access, a Chrome store update URL or Firefox metadata. `minimum_chrome_version: "120"` declares the Chromium compatibility floor, not a tested Edge release or a claim of support on every operating system.

The existing artifact gate checks Edge's manifest, resources, localized messages, JavaScript syntax and size limits. One additional packaged-browser test mounts the Edge-built popup, settings and onboarding in bundled Chromium. Existing Chrome journeys retain their default artifact and are not repeated as an Edge matrix. Bundled Chromium is not native Microsoft Edge verification.

Before publishing to Edge Add-ons:

1. Build `pnpm zip:edge` from the clean, reviewed release commit. Record the source commit, tools, extension version, exact ZIP filename and SHA-256; run `unzip -t` and inspect its root manifest and packaged resources.
2. Extract that ZIP unchanged, create a separate desktop Edge profile, then use `edge://extensions`, Developer mode and Load unpacked. Do not edit the manifest or pregrant permissions. Record the Edge version/channel and operating system. [Microsoft documents local sideloading](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading); branded Edge does not support the command-line extension-loading flags used by the bundled Chromium fixture.
3. Verify onboarding, language/theme selection, the actual toolbar popup, settings and cached favicons. Check for manifest warnings, page errors, missing resources and unexpected extension network requests. Confirm permission grant, denial and dismissal from the toolbar popup, normal Settings Save and the unsaved-changes dialog's Save button, including persistence after the popup closes.
4. Test protected navigation from both loaded and still-loading allowed pages, using the address bar and links. Check the breathing screen, Continue and automatic continuation, allowance expiry, custom schedules, browser restart and recovery after service-worker suspension without attached DevTools. Verify media pause/resume and tab-audio restoration, permission revocation/regrant, statistics reset and full reset in this disposable profile only.
5. Record each result against that exact ZIP. Native Edge acceptance remains pending until this record is complete; a successful build or Chromium run does not establish it. Run the full CI and pinned visual gates before merging or publishing.
6. Submit separately through [Microsoft Partner Center](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), supplying the ZIP, listing assets, public privacy URL and accurate permission/review notes. Do not submit the Chrome listing as the Edge listing. After approval, verify the real Edge Add-ons URL, obtain appropriate Microsoft permission and usage rights for any locally bundled official Edge artwork or implement an approved badge according to its conditions and actual listing link, then replace Edge's null download URL in the website configuration. Test the available state while signed out and confirm the artwork and download link load without a broken image before publishing.

Until a public listing is available, desktop Edge visitors see `Edge - Coming soon` with no install link. Mobile Edge is not advertised as a desktop extension target. This unavailable state is text-only; Microsoft's official [Edge Add-ons badge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/add-ons-badge) requires a clickable link to the actual listing. Store submission and website publication are separate release actions.

### Firefox review source

WXT also creates `tocusextension-0.1.0-sources.zip` when packaging Firefox. Its default source root is `apps/extension`, so it omits this monorepo's root lockfile, build configuration, and shared packages. That automatic archive is insufficient for Mozilla to reproduce this build.

After confirming `git status --short` is empty and `HEAD` is the reviewed release commit used above, create a complete tracked-workspace source archive instead:

```sh
git rev-parse HEAD
git archive --format=zip --output=apps/extension/.output/tocus-0.1.0-workspace-sources.zip HEAD
unzip -t apps/extension/.output/tocus-0.1.0-workspace-sources.zip
shasum -a 256 apps/extension/.output/tocus-0.1.0-workspace-sources.zip
```

Supply that workspace archive and these build instructions with the Firefox submission. Before submitting, extract it into an empty directory, install the pinned tools and dependencies with `pnpm install --frozen-lockfile`, and run `pnpm zip:firefox` from its root. Compare the extracted release file contents with the submitted Firefox ZIP and investigate any differences. The source archive includes `README.md`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `lingui.config.ts`, `apps/extension`, and `packages`; it excludes ignored output, installed dependencies, and uncommitted changes. Follow Mozilla's [source-code submission instructions](https://extensionworkshop.com/documentation/publish/source-code-submission/) for the actual review.

### Safari packaging

The Safari ZIP contains HTML, CSS, JavaScript, and other web-extension resources. It is not a signed Apple app or an App Store distribution archive. For the local Xcode workflow, run Apple's [Safari web-extension packager](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) against `apps/extension/.output/safari-mv2/`, using `--copy-resources` so the generated project has its own reviewed resource copy. Current Xcode calls this tool `xcrun safari-web-extension-packager`; older versions use `safari-web-extension-converter`.

Before creating the release app, confirm the intended Apple platforms, developer team, registered bundle identifiers, signing identities, entitlements, and minimum supported OS versions. Review packager compatibility warnings, add the final public privacy-policy URL to the containing app and App Store Connect, then build, sign, archive, and test installation and extension behavior on the supported Safari platforms. The web-assets archive alone does not complete those steps.

### Publication facts still required

The following release inputs were unresolved on September 9, 2026:

- [ ] Supply the final public Chrome, Firefox, and Safari listing URLs. The approved temporary URLs remain centralized in `apps/website/src/config/downloads/index.ts`; replace each when its listing is public and verify the destination while signed out.
- [ ] Complete native desktop Edge acceptance and the separate Microsoft Edge Add-ons submission. Replace Edge's null URL only when the actual listing is public, the signed-out destination and installation are verified, and the available state has been tested with approved locally bundled Edge artwork or an approved badge used according to Microsoft's conditions and the actual listing link.
- [ ] Choose the canonical HTTPS website origin and hosting provider. The repository has no production host configuration or Astro `site` origin; the repository homepage is empty, GitHub reports `has_pages: false`, and its Pages endpoint returns 404. These checks do not rule out an externally configured host.
- [ ] Confirm the host/CDN request-log fields, retention and deletion behavior, access controls, subprocessors, and region; update the website privacy copy using those verified facts. Configure canonical URLs, redirects, and production headers, then inspect the deployed site's cookies, scripts, and network requests.
- [ ] Enable GitHub private vulnerability reporting and verify the private report route from an account without repository access. A read-only check of `repos/agustinbarrientos/tocus/private-vulnerability-reporting` returned `{"enabled":false}` on September 9, 2026. [GitHub documents the repository setting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository).
- [ ] Confirm Apple release identifiers and signing details and finish the Safari app packaging steps above.
- [ ] Complete each store's privacy, data-use, and permission declarations from the exact packaged behavior, provide the final public privacy-policy URL, and resolve store review findings.
- [ ] Recheck the deployed homepage and translated routes, `/privacy/`, `/support/`, local assets, and deliberate outbound links with clean browser profiles before announcing availability.

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
