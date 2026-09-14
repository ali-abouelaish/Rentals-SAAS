# Integration logos

Brand assets for the cards on `/settings/integrations`.

This folder is empty on purpose. The repo ships no third-party brand assets, so
every integration currently renders a monogram tile in the provider's brand
colour instead. That is a deliberate fallback, not a missing file.

## Adding a real logo

1. Get the file from the provider's own brand kit or press page. Do not redraw
   or trace one — an approximation of somebody else's trademark looks wrong to
   anyone who knows the brand, and it is their asset to publish.
2. Save it here as `<integration key>.svg` — the key is the `key` field in
   `src/lib/integrations/catalog.ts` (`e_signing`, `mydeposits`, `tds`, `dps`,
   `email_sending`, `xero`, `open_banking`).
3. Set `logo.src` on that entry in the catalogue:

   ```ts
   logo: { src: "/integrations/xero.svg", brandColor: "#13B5EA", monogram: "X" },
   ```

That is the whole change. `IntegrationLogo` renders the file instead of the
tile; `brandColor` and `monogram` stay as they are so the fallback still works
if the file is ever removed.

## What the file should be

- **SVG** preferred, PNG at 2x acceptable.
- **Transparent background** — the tile behind it is white, and a baked-in
  white box will show as a visible square.
- **Roughly square.** A wide wordmark gets letterboxed into a 40px tile and
  becomes unreadable; use the provider's icon/symbol mark, not the full
  horizontal logo.
- Keep it small. These are 28px on screen; a 200KB illustration is wasted.

## Brand colours

`brandColor` is only used by the monogram fallback. The values in the catalogue
are close approximations, picked to stay legible behind white text in both
light and dark themes. If you have the provider's exact hex, use it — but check
the contrast, because some brand colours (Xero's cyan, for one) are light
enough that white text on them is borderline.
