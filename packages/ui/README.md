# Shared UI

Import Mantine controls, `TocusProvider`, `Brand`, and `Icon` from `@tocus/ui`.

```tsx
import { Button, TocusProvider } from '@tocus/ui';
import '@tocus/ui/styles.scss';

<TocusProvider>
  <Button>Save</Button>
</TocusProvider>
```

Stylesheet exports: `styles.scss` for the full UI, `pause.scss` for the injected pause, `charts.scss` for charts, and `notifications.scss` for notifications.

The provider defaults to system appearance, brown, and 115% scale; `compact` uses 100%. Consumers own preference persistence. Import `IconName`, `TocusAppearance`, and `TocusPalette` from `@tocus/ui/types` in Node tools.

Use shared theme variants and layout classes from `src/components/provider/shared.scss`. Application styles must not duplicate control states. Icons use `IconName` constants and retain their [asset notices](../theme/README.md#icon-assets-and-licenses).

For injected UI, compile styles with `?inline`, adopt them with `createShadowStyleSheet`, and pass the owned `shadowRoot` to the provider. Keep styles and portals inside that root. Shadow styles already resolve rem units against 16px; do not adjust scale for the host page. Avoid nested Mantine dialogs inside the pause's closed shadow root.

In Astro, providers and consumers must share one React island. Run `pnpm --filter @tocus/ui test:browser` to check shared controls.
