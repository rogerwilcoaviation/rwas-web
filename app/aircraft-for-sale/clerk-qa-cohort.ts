// This public hint selects the temporary QA interface. It is not an identity
// proof: the Worker separately verifies the provider email before adoption.
export const CLERK_QA_EMAILS = Object.freeze([
  'jerry+rwas-seller-qa-a-20261021-r1@rwas.team',
  'jerry+rwas-seller-qa-b-20261021-r1@rwas.team',
] as const);
export const CLERK_QA_QUERY = 'seller-qa-email';
export const CLERK_QA_HEADER = 'X-RWAS-QA-Email';

export function clerkQaEmail(value: unknown): string | null {
  return typeof value === 'string' &&
    CLERK_QA_EMAILS.some((email) => value === email)
    ? value
    : null;
}

export function clerkQaEmailFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const values = params.getAll(CLERK_QA_QUERY);
  return values.length === 1 ? clerkQaEmail(values[0]) : null;
}

export function clerkQaMethodsHeaders(search: string) {
  const email = clerkQaEmailFromSearch(search);
  return email ? { [CLERK_QA_HEADER]: email } : undefined;
}

export type ClerkQaCohort = Readonly<{
  qaOnly: boolean;
  email: string | null;
}>;

export function selectClerkQaCohort(
  methods: unknown,
  search: string,
): ClerkQaCohort {
  const response =
    methods && typeof methods === 'object'
      ? (methods as { clerkQaOnly?: unknown; clerkQaEmail?: unknown })
      : {};
  if (response.clerkQaOnly !== true)
    return Object.freeze({ qaOnly: false, email: null });
  const requested = clerkQaEmailFromSearch(search);
  return Object.freeze({
    qaOnly: true,
    email:
      requested && response.clerkQaEmail === requested ? requested : null,
  });
}

export function clerkQaAuthUrl(
  sellerUrl: string,
  stage: 'sign-up' | 'complete',
  cohort: ClerkQaCohort,
): string {
  const url = new URL(sellerUrl);
  url.searchParams.set('seller-auth', stage);
  if (cohort.qaOnly) {
    const email = clerkQaEmail(cohort.email);
    if (!email) throw new Error('QA seller sign-in is unavailable.');
    url.searchParams.set(CLERK_QA_QUERY, email);
  }
  return url.href;
}
