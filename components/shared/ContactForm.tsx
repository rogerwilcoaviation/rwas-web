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
const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name.').max(120),
  email: z.string().email('Please enter a valid email.').max(254),
  phone: z
    .string()
    .max(40)
    .optional()
    .or(z.literal('')),
  aircraftMakeModel: z.string().max(120).optional().or(z.literal('')),
  nNumber: z
    .string()
    .max(10)
    .regex(/^[A-Za-z0-9-]*$/i, 'N-numbers are letters, numbers, and dashes only.')
    .optional()
    .or(z.literal('')),
  preferredContact: z.enum(['email', 'phone', 'either']).default('either'),
  bestTimeToCall: z.string().max(120).optional().or(z.literal('')),
  reason: z.enum(['quote', 'general', 'service', 'papa-alpha', 'aircraft-sales']).default('general'),
  product: z.string().max(240).optional().or(z.literal('')),
  sku: z.string().max(120).optional().or(z.literal('')),
  message: z.string().min(10, 'A sentence or two helps us reply faster.').max(4000),
  // honeypot: bots fill this; real humans never see it
  website: z.string().max(0).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

// --- Reason presets (drive the kicker copy + subject line) ----------------
const REASON_LABELS: Record<ContactFormValues['reason'], string> = {
  quote: 'Request a quote',
  general: 'General inquiry',
  service: 'Service / maintenance',
  'papa-alpha': 'Papa-Alpha tool inquiry',
  'aircraft-sales': 'Aircraft for sale',
};

export default function ContactForm() {
  const TURNSTILE_SITE_KEY =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

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
  } = useForm<ContactFormValues>({
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
    const reasonParam = params.get('reason') as ContactFormValues['reason'] | null;

    if (product) {
      setValue('product', product);
      // Product context implies a quote request unless reason is pinned
      if (!reasonParam) setValue('reason', 'quote');
    }
    if (sku) setValue('sku', sku);
    if (reasonParam && reasonParam in REASON_LABELS) {
      setValue('reason', reasonParam);
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
        ticketId: data.ticketId || `RWAS-${Date.now().toString(36).toUpperCase()}`,
      });
      reset();
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

  const selectedReason = watch('reason');
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
          A confirmation has been sent to your email. The shop typically replies
          within one business day. If it&rsquo;s urgent, call us at{' '}
          <a href="tel:+16052998178">(605) 299-8178</a>.
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
          <p className="bs-kicker">{REASON_LABELS[selectedReason] || 'Inquiry'}</p>
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
            <label htmlFor="aircraftMakeModel">Aircraft make / model</label>
            <input
              id="aircraftMakeModel"
              type="text"
              placeholder="e.g. Cessna 182P"
              {...register('aircraftMakeModel')}
            />
          </div>

          <div className="rwas-field">
            <label htmlFor="nNumber">N-number</label>
            <input
              id="nNumber"
              type="text"
              placeholder="e.g. N12345"
              {...register('nNumber')}
              aria-invalid={Boolean(errors.nNumber)}
            />
            {errors.nNumber ? (
              <p className="rwas-field__error">{errors.nNumber.message}</p>
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
              {(Object.keys(REASON_LABELS) as Array<ContactFormValues['reason']>).map(
                (key) => (
                  <option key={key} value={key}>
                    {REASON_LABELS[key]}
                  </option>
                ),
              )}
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

        <div className="rwas-field rwas-field--full">
          <label htmlFor="message">Message *</label>
          <textarea
            id="message"
            rows={6}
            placeholder="Tell us about the airplane, the mission, and what you're trying to accomplish. The more context we have, the sharper the quote."
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
            Routed to <strong>service@rwas.team</strong>. We never share your
            contact information.
          </p>
        </div>
      </form>
    </>
  );
}
