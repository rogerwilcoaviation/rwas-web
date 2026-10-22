// Discovery/UI routing only. The server independently authorizes the exact QA
// cohort; this public query/header pair grants no identity or seller access.
export function isBetterAuthQaEntry(search: string) {
  const values = new URLSearchParams(search).getAll('seller-auth-qa');
  return values.length === 1 && values[0] === 'better-auth';
}

export function betterAuthQaMethodsHeaders(
  search: string,
): Record<string, string> {
  return isBetterAuthQaEntry(search)
    ? { 'X-RWAS-Seller-QA': 'better-auth' }
    : {};
}
