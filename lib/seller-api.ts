// Same-origin Pages binding. Preview must bind its own isolated seller service.
export const SELLER_API = '/api/aircraft-sale';
export async function sellerRequest(
  path: string,
  session: string,
  options: RequestInit = {},
) {
  return fetch(SELLER_API + path, {
    ...options,
    cache: 'no-store',
    headers: { ...options.headers, Authorization: 'Bearer ' + session },
  });
}
