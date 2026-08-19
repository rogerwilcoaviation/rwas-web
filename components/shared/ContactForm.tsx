'use client';

/*
 * ContactForm — the RWAS Correspondence Desk.
 *
 * Single unified contact/quote form. Context-aware: reads ?product=,
 * ?sku=, and ?reason= from the URL so that a click from a PDP "Request
 * a Quote" button pre-fills the product field and switches the subject
 * line to a quote request.
 *
 * Submission flow:
 *   1. Client validates with zod via react-hook-form
 *   2. Turnstile widget gates submit with a token
 *   3. POST /api/contact (Cloudflare Pages Function)
 *   4. Function verifies Turnstile, sends via Resend → service@rwas.team
 *   5. On success, form collapses to a ticket-stub confirmation card
 *
 * Required env vars (build-time):
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  — public Turnstile sitekey
 *
 * Required env vars (CF Pages runtime, set as Worker secrets):
 *   RESEND_API_KEY       — Resend API key for rwas.team domain
 *   TURNSTILE_SECRET_KEY — Turnstile secret (NEVER exposed to the browser)
 *   CONTACT_TO_EMAIL     — delivery address (defaults to service@rwas.team)
 *   CONTACT_FROM_EMAIL   — sender, must be on a Resend-verified domain
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

// --- Turnstile typings (loaded as a global by CF script) ------------------
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

// --- Schema ---------------------------------------------------------------
const contactSchema = z
  .object({
    name: z.string().min(2, 'Please enter your name.').max(120),
    email: z.string().email('Please enter a valid email.').max(254),
    phone: z.string().max(40).optional().or(z.literal('')),
    aircraftYear: z.string().max(4).optional().or(z.literal('')),
    aircraftMake: z.string().trim().max(80).optional().or(z.literal('')),
    aircraftModel: z.string().trim().max(80).optional().or(z.literal('')),
    aircraftSerialNumber: z
      .string()
      .trim()
      .max(80)
      .optional()
      .or(z.literal('')),
    nNumber: z.string().trim().max(10).optional().or(z.literal('')),
    aircraftStatus: z
      .enum(['registered', 'under-construction', 'identifiers-not-assigned'])
      .optional()
      .or(z.literal('')),
    preferredContact: z.enum(['email', 'phone', 'either']).default('either'),
    bestTimeToCall: z.string().max(120).optional().or(z.literal('')),
    reason: z
      .enum(['quote', 'general', 'service', 'papa-alpha', 'aircraft-sales'])
      .default('general'),
    product: z.string().max(240).optional().or(z.literal('')),
    sku: z.string().max(120).optional().or(z.literal('')),
    // Lead-source attribution (e.g. "home-cta", "pdp-quote"). Never shown to user.
    source: z.string().max(120).optional().or(z.literal('')),
    utm_source: z.string().max(240).optional().or(z.literal('')),
    utm_medium: z.string().max(240).optional().or(z.literal('')),
    utm_campaign: z.string().max(240).optional().or(z.literal('')),
    utm_content: z.string().max(240).optional().or(z.literal('')),
    utm_term: z.string().max(240).optional().or(z.literal('')),
    requestId: z.string().max(120).optional().or(z.literal('')),
    plannerKind: z
      .enum(['certified', 'experimental'])
      .optional()
      .or(z.literal('')),
    createdAt: z.string().max(80).optional().or(z.literal('')),
    pricingReference: z.string().max(160).optional().or(z.literal('')),
    priceBasis: z.literal('manufacturer-list-price').optional().or(z.literal('')),
    advisories: z.array(z.string().max(400)).max(30).optional(),
    components: z
      .array(
        z.object({
          title: z.string().max(240),
          sku: z.string().max(120),
          quantity: z.number().int().min(1).max(6),
          unitPrice: z.number().nonnegative(),
          extendedPrice: z.number().nonnegative(),
        }),
      )
      .max(100)
      .optional(),
    message: z
      .string()
      .min(10, 'A sentence or two helps us reply faster.')
      .max(4000),
    // honeypot: bots fill this; real humans never see it
    website: z.string().max(0).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.reason !== 'quote') return;
    if (!values.aircraftMake?.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['aircraftMake'],
        message: 'Please enter the aircraft make for a quote.',
      });
    if (!values.aircraftModel?.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['aircraftModel'],
        message: 'Please enter the aircraft model for a quote.',
      });
    if (!values.aircraftStatus)
      ctx.addIssue({
        code: 'custom',
        path: ['aircraftStatus'],
        message: 'Please choose the aircraft status.',
      });
    if (values.aircraftStatus === 'registered') {
      if (!/^\d{4}$/.test(values.aircraftYear || ''))
        ctx.addIssue({
          code: 'custom',
          path: ['aircraftYear'],
          message: 'Registered-aircraft quotes need a four-digit year.',
        });
      if (!values.aircraftSerialNumber?.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['aircraftSerialNumber'],
          message: 'Registered-aircraft quotes need a serial number.',
        });
      if (!values.nNumber?.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['nNumber'],
          message: 'Registered-aircraft quotes need an N-number.',
        });
    }
    if (values.nNumber && !/^[A-Za-z0-9-]+$/i.test(values.nNumber))
      ctx.addIssue({
        code: 'custom',
        path: ['nNumber'],
        message: 'N-numbers are letters, numbers, and dashes only.',
      });
  });

type ContactFormValues = z.infer<typeof contactSchema>;
type ContactFormInput = z.input<typeof contactSchema>;

type AxisContactDraft = {
  requestId: string;
  plannerKind: 'certified' | 'experimental';
  createdAt: string;
  source: string;
  pricingReference: string;
  priceBasis?: 'manufacturer-list-price';
  message: string;
  components?: ContactFormValues['components'];
  advisories?: string[];
  attribution?: Partial<Record<AttributionKey, string>>;
  total?: number;
};

// --- Reason presets (drive the kicker copy + subject line) ----------------
const REASON_LABELS: Record<ContactFormValues['reason'], string> = {
  quote: 'Request a quote',
  general: 'General inquiry',
  service: 'Service / maintenance',
  'papa-alpha': 'Papa-Alpha tool inquiry',
  'aircraft-sales': 'Aircraft for sale',
};

export default function ContactForm() {
  const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  const [submitState, setSubmitState] = useState<
    | { status: 'idle' }
    | { status: 'submitting' }
    | { status: 'success'; ticketId: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<ContactFormInput, unknown, ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      preferredContact: 'either',
      reason: 'general',
    },
  });

  // --- Read URL context (?product=, ?sku=, ?reason=) on mount ------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const product = params.get('product');
    const sku = params.get('sku');
    const reasonParam = params.get('reason') as
      | ContactFormValues['reason']
      | null;

    if (product) {
      setValue('product', product);
      // Product context implies a quote request unless reason is pinned
      if (!reasonParam) setValue('reason', 'quote');
    }
    if (sku) setValue('sku', sku);
    if (reasonParam && reasonParam in REASON_LABELS) {
      setValue('reason', reasonParam);
    }
    const source = params.get('source');
    if (source) setValue('source', source);
    for (const key of ATTRIBUTION_KEYS) {
      const value = params.get(key);
      if (value) setValue(key, value);
    }
    const draftValue = window.sessionStorage.getItem('rwas-contact-draft');
    if (
      draftValue &&
      params.get('draft') === 'axis'
    ) {
      try {
        const draft = JSON.parse(draftValue) as AxisContactDraft;
        if (draft.message) setValue('message', draft.message.slice(0, 4000));
        if (draft.source && !source) setValue('source', draft.source);
        if (draft.requestId) setValue('requestId', draft.requestId);
        if (draft.plannerKind) setValue('plannerKind', draft.plannerKind);
        if (draft.createdAt) setValue('createdAt', draft.createdAt);
        if (draft.pricingReference)
          setValue('pricingReference', draft.pricingReference);
        if (draft.priceBasis) setValue('priceBasis', draft.priceBasis);
        if (draft.components) setValue('components', draft.components);
        if (draft.advisories) setValue('advisories', draft.advisories);
        if (draft.attribution) {
          for (const key of ATTRIBUTION_KEYS) {
            const value = draft.attribution[key];
            if (value && !params.get(key)) setValue(key, value);
          }
        }
      } catch {
        // Preserve and support the legacy plain-string draft format.
        setValue('message', draftValue.slice(0, 4000));
      }
    }
  }, [setValue]);

  // --- Render Turnstile once the script loads ----------------------------
  const onTurnstileScriptLoad = () => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!window.turnstile || !turnstileContainerRef.current) return;
    if (turnstileWidgetIdRef.current) return;
    turnstileWidgetIdRef.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'error-callback': () => setTurnstileToken(''),
        'expired-callback': () => setTurnstileToken(''),
        theme: 'light',
      },
    );
  };

  const onSubmit = async (values: ContactFormValues) => {
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setSubmitState({
        status: 'error',
        message: 'Please complete the verification challenge below.',
      });
      return;
    }

    setSubmitState({ status: 'submitting' });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, turnstileToken }),
      });
      const data = (await res.json()) as { ticketId?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSubmitState({
        status: 'success',
        ticketId:
          data.ticketId || `RWAS-${Date.now().toString(36).toUpperCase()}`,
      });
      reset();
      window.sessionStorage.removeItem('rwas-contact-draft');
      window.sessionStorage.removeItem('rwas-axis-request-id');
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
      setTurnstileToken('');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please email service@rwas.team directly.';
      setSubmitState({ status: 'error', message });
    }
  };

  const selectedReason = watch('reason') ?? 'general';
  const selectedAircraftStatus = watch('aircraftStatus');
  const productContext = watch('product');

  // --- Success state: ticket-stub confirmation ---------------------------
  if (submitState.status === 'success') {
    return (
      <div className="rwas-contact-confirm">
        <p className="rwas-contact-confirm__kicker">Message received</p>
        <h2 className="rwas-contact-confirm__head">
          Your inquiry is on the Avionics Desk.
        </h2>
        <p className="rwas-contact-confirm__body">
          The shop typically replies within one business day. If it&rsquo;s
          urgent, call us at <a href="tel:+16052998178">(605) 299-8178</a>.
        </p>
        <dl className="rwas-contact-confirm__stub">
          <dt>Reference</dt>
          <dd>{submitState.ticketId}</dd>
          <dt>Routed to</dt>
          <dd>service@rwas.team</dd>
        </dl>
        <button
          type="button"
          className="bs-cta-primary"
          onClick={() => setSubmitState({ status: 'idle' })}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Cloudflare Turnstile loader — no-op if sitekey not configured */}
      {TURNSTILE_SITE_KEY ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={onTurnstileScriptLoad}
        />
      ) : null}

      <form
        className="rwas-contact-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <header className="rwas-contact-form__intro">
          <p className="bs-kicker">
            {REASON_LABELS[selectedReason] || 'Inquiry'}
          </p>
          <h2 className="bs-section-head">
            {productContext
              ? `Quote request: ${productContext}`
              : 'Tell us what you need.'}
          </h2>
        </header>

        {/* honeypot — visually hidden; bots fill it, we drop on server */}
        <div className="rwas-hp" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            type="text"
            id="website"
            tabIndex={-1}
            autoComplete="off"
            {...register('website')}
          />
        </div>

        <div className="rwas-contact-form__grid">
          <div className="rwas-field">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? (
              <p className="rwas-field__error">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              {...register('email')}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? (
              <p className="rwas-field__error">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="Optional"
              {...register('phone')}
            />
          </div>

          <div className="rwas-field">
            <label htmlFor="preferredContact">Preferred contact</label>
            <select id="preferredContact" {...register('preferredContact')}>
              <option value="either">Email or phone</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </div>

          <div className="rwas-field">
            <label htmlFor="aircraftYear">
              Aircraft year
              {selectedReason === 'quote' &&
              selectedAircraftStatus === 'registered'
                ? ' *'
                : ''}
            </label>
            <input
              id="aircraftYear"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 1980"
              maxLength={4}
              required={
                selectedReason === 'quote' &&
                selectedAircraftStatus === 'registered'
              }
              {...register('aircraftYear')}
              aria-invalid={Boolean(errors.aircraftYear)}
            />
            {errors.aircraftYear ? (
              <p className="rwas-field__error">{errors.aircraftYear.message}</p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="aircraftMake">
              Aircraft make{selectedReason === 'quote' ? ' *' : ''}
            </label>
            <input
              id="aircraftMake"
              type="text"
              placeholder="e.g. Cessna"
              required={selectedReason === 'quote'}
              {...register('aircraftMake')}
              aria-invalid={Boolean(errors.aircraftMake)}
            />
            {errors.aircraftMake ? (
              <p className="rwas-field__error">{errors.aircraftMake.message}</p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="aircraftModel">
              Aircraft model{selectedReason === 'quote' ? ' *' : ''}
            </label>
            <input
              id="aircraftModel"
              type="text"
              placeholder="e.g. R182"
              required={selectedReason === 'quote'}
              {...register('aircraftModel')}
              aria-invalid={Boolean(errors.aircraftModel)}
            />
            {errors.aircraftModel ? (
              <p className="rwas-field__error">
                {errors.aircraftModel.message}
              </p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="aircraftSerialNumber">
              Aircraft serial number
              {selectedReason === 'quote' &&
              selectedAircraftStatus === 'registered'
                ? ' *'
                : ''}
            </label>
            <input
              id="aircraftSerialNumber"
              type="text"
              placeholder="Enter the manufacturer serial number"
              required={
                selectedReason === 'quote' &&
                selectedAircraftStatus === 'registered'
              }
              {...register('aircraftSerialNumber')}
              aria-invalid={Boolean(errors.aircraftSerialNumber)}
            />
            {errors.aircraftSerialNumber ? (
              <p className="rwas-field__error">
                {errors.aircraftSerialNumber.message}
              </p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="nNumber">
              N-number
              {selectedReason === 'quote' &&
              selectedAircraftStatus === 'registered'
                ? ' *'
                : ''}
            </label>
            <input
              id="nNumber"
              type="text"
              placeholder="e.g. N12345"
              required={
                selectedReason === 'quote' &&
                selectedAircraftStatus === 'registered'
              }
              {...register('nNumber')}
              aria-invalid={Boolean(errors.nNumber)}
            />
            {errors.nNumber ? (
              <p className="rwas-field__error">{errors.nNumber.message}</p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="aircraftStatus">
              Aircraft status{selectedReason === 'quote' ? ' *' : ''}
            </label>
            <select
              id="aircraftStatus"
              {...register('aircraftStatus')}
              aria-invalid={Boolean(errors.aircraftStatus)}
              aria-describedby={
                errors.aircraftStatus ? 'aircraftStatus-error' : undefined
              }
            >
              <option value="">Not specified</option>
              <option value="registered">Registered / operational</option>
              <option value="under-construction">Under construction</option>
              <option value="identifiers-not-assigned">
                Registration / identifiers not assigned
              </option>
            </select>
            {errors.aircraftStatus ? (
              <p
                id="aircraftStatus-error"
                className="rwas-field__error"
                role="alert"
              >
                {errors.aircraftStatus.message}
              </p>
            ) : null}
          </div>

          <div className="rwas-field">
            <label htmlFor="bestTimeToCall">Best time to call</label>
            <input
              id="bestTimeToCall"
              type="text"
              placeholder="e.g. Weekday mornings, CT"
              {...register('bestTimeToCall')}
            />
          </div>

          <div className="rwas-field">
            <label htmlFor="reason">What can we help with?</label>
            <select id="reason" {...register('reason')}>
              {(
                Object.keys(REASON_LABELS) as Array<ContactFormValues['reason']>
              ).map((key) => (
                <option key={key} value={key}>
                  {REASON_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hidden context fields — prefilled from URL, editable by power users */}
        {productContext ? (
          <div className="rwas-field rwas-field--product-context">
            <label htmlFor="product">Product (from your click)</label>
            <input id="product" type="text" {...register('product')} />
            <input type="hidden" {...register('sku')} />
          </div>
        ) : (
          <>
            <input type="hidden" {...register('product')} />
            <input type="hidden" {...register('sku')} />
          </>
        )}
        {/* Lead-source attribution — always hidden, populated from ?source= */}
        <input type="hidden" {...register('source')} />
        {ATTRIBUTION_KEYS.map((key) => (
          <input key={key} type="hidden" {...register(key)} />
        ))}
        <input type="hidden" {...register('requestId')} />
        <input type="hidden" {...register('plannerKind')} />
        <input type="hidden" {...register('createdAt')} />
        <input type="hidden" {...register('pricingReference')} />
        <input type="hidden" {...register('priceBasis')} />

        <div className="rwas-field rwas-field--full">
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            rows={6}
            placeholder="Tell us about the airplane, the mission, and what you're trying to accomplish. The more context we have, the sharper the quote."
            required
            {...register('message')}
            aria-invalid={Boolean(errors.message)}
          />
          {errors.message ? (
            <p className="rwas-field__error">{errors.message.message}</p>
          ) : null}
        </div>

        {TURNSTILE_SITE_KEY ? (
          <div className="rwas-turnstile">
            <div ref={turnstileContainerRef} />
          </div>
        ) : null}

        {submitState.status === 'error' ? (
          <div className="bs-cta-error" role="alert">
            {submitState.message}
          </div>
        ) : null}

        <div className="rwas-contact-form__actions">
          <button
            type="submit"
            className="bs-cta-primary"
            disabled={submitState.status === 'submitting'}
          >
            {submitState.status === 'submitting' ? 'Sending…' : 'Send to RWAS'}
          </button>
          <p className="rwas-contact-form__fineprint">
            Routed to <strong>service@rwas.team</strong>. Direct avionics
            questions may also use <strong>avionics@rwas.team</strong>. RWAS
            does not sell your private information, including your email address
            or phone number. See our <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </form>
    </>
  );
}
