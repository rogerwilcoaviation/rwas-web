import type { Clerk } from '@clerk/clerk-js';

export const CLERK_PRODUCTION_UI_VERSION = '1.39.0';
export const CLERK_PRODUCTION_UI_URL =
  'https://clerk.rogerwilcoaviation.com/npm/@clerk/ui@' +
  CLERK_PRODUCTION_UI_VERSION +
  '/dist/ui.browser.js';

type ClerkLoadOptions = NonNullable<Parameters<Clerk['load']>[0]>;
type ClerkUi = NonNullable<ClerkLoadOptions['ui']>;
type ClerkUiConstructor = ClerkUi['ClerkUI'];
type ClerkUiGlobal = typeof globalThis & {
  __internal_ClerkUICtor?: ClerkUiConstructor;
};

let productionUi: Promise<ClerkUi> | null = null;

export function loadClerkProductionUi(
  documentObject: Document = document,
  globalObject: ClerkUiGlobal = globalThis as ClerkUiGlobal,
): Promise<ClerkUi> {
  if (productionUi) return productionUi;
  productionUi = new Promise((resolve, reject) => {
    const loaded = () => {
      const ClerkUI = globalObject.__internal_ClerkUICtor;
      if (
        typeof ClerkUI !== 'function' ||
        ClerkUI.version !== CLERK_PRODUCTION_UI_VERSION
      ) {
        reject(new Error('Clerk production UI constructor is unavailable.'));
        return;
      }
      resolve({ ClerkUI });
    };
    if (typeof globalObject.__internal_ClerkUICtor === 'function') {
      loaded();
      return;
    }
    const script = documentObject.createElement('script');
    script.src = CLERK_PRODUCTION_UI_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Clerk production UI could not be loaded.')),
      { once: true },
    );
    documentObject.head.append(script);
  }).catch((error) => {
    productionUi = null;
    throw error;
  });
  return productionUi;
}
