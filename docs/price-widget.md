# Embeddable price widget

Every card price page (`/prices/<category>/<slug>`) has an **Embed this price**
button above the price-history chart. It gives a copy-paste snippet for blogs,
forums and club sites:

```html
<a href="https://cardpop.com.au/prices/pokemon/charizard-base-set-4" title="…">
  <img src="https://cardpop.com.au/hcgi/api/public/price-widget/charizard-base-set-4.svg"
       alt="…" width="320" height="170" loading="lazy" style="border:0" />
</a>
```

## Why an image and not an iframe

The widget is there to earn backlinks. A link inside an iframe belongs to the
framed CardPop document, so it passes nothing to CardPop's ranking. A plain
followed `<a>` on the host page around an `<img>` does. An image also needs no
script and no change to `frame-ancestors`, and it works anywhere an image does,
including forum posts that strip iframes. Never add `rel="nofollow"` to the
snippet; a test checks for it.

## How it works

- `utils/priceWidget.js` is dependency-free and shared by the browser and the
  server. It builds the snippet (`priceWidgetSnippet`) and draws the SVG
  (`priceWidgetSvg`): card name, set, latest raw and graded averages in AUD, a
  sparkline of up to 90 snapshots, the % change over that period, the
  "Updated" date and the CardPop wordmark.
- `GET /public/price-widget/:slug.svg` (`src/routes/public.js`) reads the card
  and its snapshots with the **anon** client, so RLS applies and only `active`
  tracked cards are drawn. It keeps its own micro-cache (`priceWidgetCache`) and
  answers `s-maxage=3600`, because snapshots refresh once a day. It sends
  `Cross-Origin-Resource-Policy: cross-origin`, because Helmet's default
  `same-origin` would stop other sites loading the image.
- An unknown or inactive card answers 404 with a neutral "Australian card
  prices" image, so an old embed never shows as a broken image. A failed read
  answers 503 with the same image and `no-store`, and nothing is cached.

Every number on the widget comes from `card_price_snapshots`. A card with no
snapshots shows "AUD price coming soon", never a placeholder figure.
