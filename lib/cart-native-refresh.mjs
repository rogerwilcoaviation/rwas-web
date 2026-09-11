/**
 * Select only reviewed exact variants whose stored pre-discount line cost is
 * higher than Shopify's current variant price. Inputs stay server-owned.
 * Returned native updates preserve line identity and quantity; no price input.
 * @param {{lines?: {edges?: Array<{node?: {id: string, quantity: number, merchandise?: {id?: string, sku?: string, price?: {amount: string, currencyCode: string}}, cost?: {subtotalAmount?: {amount: string, currencyCode: string}}}|null}>}}|null} cart
 * @param {Array<{variantId: string, sku: string}>} reviewed
 */
export function stalePublicPriceLines(cart, reviewed) {
  return (cart?.lines?.edges || [])
    .map((edge) => edge.node)
    .filter((line) => {
      if (!line || !Number.isInteger(line.quantity) || line.quantity < 1)
        return false;
      const price = line.merchandise?.price;
      const subtotal = line.cost?.subtotalAmount;
      if (!price || !subtotal || price.currencyCode !== subtotal.currencyCode)
        return false;
      if (
        !reviewed.some(
          (entry) =>
            entry.variantId === line.merchandise?.id &&
            entry.sku === line.merchandise?.sku,
        )
      )
        return false;
      const current = Math.round(Number(price.amount) * line.quantity * 100);
      const stored = Math.round(Number(subtotal.amount) * 100);
      return (
        Number.isFinite(current) && Number.isFinite(stored) && stored > current
      );
    })
    .map((line) => ({ id: line.id, quantity: line.quantity }));
}
