import exceptions from '@/data/cart-purchase-exceptions.json';

type ExceptionVariant = { id?: string | null; sku?: string | null };
type ExceptionProduct = {
  id?: string | null;
  handle?: string | null;
  variants?: ExceptionVariant[];
};

/** Explicit purchase permission only; never changes installation classification. */
export function isCartPurchaseException({
  product,
  variant,
}: {
  product?: ExceptionProduct | null;
  variant?: ExceptionVariant | null;
}): boolean {
  return exceptions.some(
    (entry) =>
      product?.id === entry.productId &&
      product?.handle === entry.handle &&
      variant?.id === entry.variantId &&
      variant?.sku === entry.sku,
  );
}

/** Fail closed if a new/unapproved variant is added to the product. */
export function isCartPurchaseExceptionProduct(
  product: ExceptionProduct,
): boolean {
  return Boolean(
    product.variants?.length &&
      product.variants.every((variant) =>
        isCartPurchaseException({ product, variant }),
      ),
  );
}
