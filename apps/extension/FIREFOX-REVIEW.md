# Building TOCus 1.0.0 for Firefox review

The reviewer source archive includes the shared workspace packages and dependency lockfile. Run the commands below from the directory containing `pnpm-workspace.yaml`.

## Environment and build

The submitted package uses Node.js 24.17.0 and pnpm 12.5.1. The package manifests support Node.js >=24.16.0 and <25; use 24.17.0 to reproduce this release build.

```sh
npm install --global pnpm@12.5.1
pnpm install --frozen-lockfile
pnpm build:firefox
```

Compare `apps/extension/.output/firefox-mv2/` with the contents of `tocusextension-1.0.0-firefox.zip`. The manifest is at the root of that output directory. The website doesn't need to be built. No credentials, signing keys, environment secrets, or paid services are needed.

WXT and Vite bundle TypeScript, React, Sass, and Lingui. Workspace package manifests declare dependencies and `pnpm-lock.yaml` pins them. Local packages are included under `packages/`.

## Testing

Submit this release for desktop Firefox 140 or later only. Android hasn't been verified for this release.

Load the built manifest as a temporary add-on using `about:debugging`. Complete onboarding, add a website such as example.com, and grant its requested website and navigation access. The default pause lasts 10 seconds and grants 5 minutes of browsing. Visit the selected website, wait, and continue. Settings control timing and schedules. Statistics and settings stay in the browser; no account is needed.

## Dynamic code evaluation

The extension build fixes Zod's supported `jitless` option to `true` before bundling, which removes the capability probe and unused code generator. The scoped build transform is in `apps/extension/config/vite/services/create-interpreted-validation-plugin/index.ts`. Data validation continues through Zod's interpreter. The build also selects decimal.js-light's official `decimal.mjs` entry instead of its legacy UMD entry and global-object fallback. These choices are configured in `apps/extension/wxt.config.ts`.

All executable code is bundled locally. The submitted JavaScript doesn't compile strings through `eval` or the `Function` constructor. Build tests inspect emitted JavaScript, and a bundled validation test verifies valid and invalid data without attempting dynamic code generation.

## Remaining validation warnings

Mozilla's add-on linter reports five `innerHTML` warnings in bundled React DOM and the custom-elements polyfill. React's HTML insertion is used only for repository SVG artwork imported at build time, in `packages/ui/src/components/icon/index.tsx`, `packages/ui/src/components/brand/index.tsx`, and `apps/extension/src/features/interruption/components/screen/view.tsx`. Website addresses, user input, translation strings, and network responses aren't passed to those HTML insertion properties. The custom-elements polyfill supports the injected breathing element. Its implementation remains unchanged.

The Android minimum-version warning concerns the `data_collection_permissions` declaration. Desktop Firefox supports that declaration from version 140; the reported Android requirement is version 142. Select desktop Firefox only for this submission.

## Library sources

Versions are pinned in `pnpm-lock.yaml`; install the official npm packages with the frozen-lockfile command above.

- React and React DOM 19.2.8: https://github.com/facebook/react and https://www.npmjs.com/package/react-dom/v/19.2.8
- Custom Elements polyfill 1.6.0: https://github.com/webcomponents/polyfills/tree/master/packages/custom-elements and https://www.npmjs.com/package/@webcomponents/custom-elements/v/1.6.0
- Zod 4.5.4: https://github.com/colinhacks/zod and https://www.npmjs.com/package/zod/v/4.5.4
- decimal.js-light 2.5.1: https://github.com/MikeMcl/decimal.js-light and https://www.npmjs.com/package/decimal.js-light/v/2.5.1
