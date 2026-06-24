// Currency formatting helper. Formats an integer cent amount using the
// currency descriptor (code/symbol/template) attached to a product variant.
// Pure presentation logic — makes no external calls.
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
