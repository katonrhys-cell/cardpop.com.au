// Currency formatting helper retained from the former Hostinger e-commerce
// integration. The shop now runs entirely on the `shop_products` table —
// product data, pricing, stock and checkout are handled via Supabase and the
// CardPop Stripe endpoints (see src/routes/stripe.js). No external Hostinger
// calls remain.

export const formatCurrency = (priceInCents, currencyInfo) => {
  if (!currencyInfo || priceInCents === null || priceInCents === undefined) {
    return "";
  }

  const { code, symbol, template } = currencyInfo;
  const currencyDisplay = symbol || code || "€";
  const amount = (priceInCents / 100).toFixed(2);

  if (template) {
    return template.replace("$1", amount);
  }

  return `${currencyDisplay}${amount}`;
};
