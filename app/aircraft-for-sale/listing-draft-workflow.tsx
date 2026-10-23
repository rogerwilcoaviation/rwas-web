'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  draftFields,
  mediaLimits,
  mediaSteps,
  validateDraftField,
} from './listing-draft-fields';
import { proofreadDescription } from './description-proofreader';

type Props = {
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  busy: boolean;
  saved: boolean;
  onSave: () => Promise<boolean>;
  onSubmitReview: () => Promise<void>;
  renderMedia: (category: string) => ReactNode;
  mediaCounts: Record<string, number>;
};

export function ListingDraftWorkflow({
  values,
  onChange,
  busy,
  saved,
  onSave,
  onSubmitReview,
  renderMedia,
  mediaCounts,
}: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const field = draftFields[step];
  const media = mediaSteps[step - draftFields.length];
  const reviewStep = draftFields.length + mediaSteps.length;
  const review = step === reviewStep;
  const missing = draftFields.filter((item) =>
    validateDraftField(item, values[item.name]),
  );
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  function go(next: number) {
    setError('');
    setStep(next);
  }
  function validateSavedValues() {
    const invalid = draftFields.findIndex(
      (item) =>
        values[item.name]?.trim() &&
        validateDraftField(item, values[item.name]),
    );
    if (invalid < 0) return true;
    setStep(invalid);
    setError(
      validateDraftField(
        draftFields[invalid],
        values[draftFields[invalid].name],
      ),
    );
    return false;
  }
  async function next() {
    if (field) {
      const notice = validateDraftField(field, values[field.name]);
      if (notice) {
        setError(notice);
        document.getElementById('listing-step-input')?.focus();
        return;
      }
    }
    if (
      step === draftFields.length - 1 &&
      (!validateSavedValues() || !(await onSave()))
    )
      return;
    go(Math.min(step + 1, reviewStep));
  }

  return (
    <section className="listing-workflow" aria-label="Guided listing draft">
      <p className="workflow-intro">
        One item at a time. Make, model, year and asking price are required
        before submission. Other details and attachments are optional.
      </p>
      <div className="workflow-progress" aria-label="Listing progress">
        <span>
          Step {step + 1} of {reviewStep + 1}
        </span>
        <span>
          {review
            ? 'Review'
            : media
              ? 'Attachments · Optional'
              : field.required
                ? 'Required'
                : 'Optional'}
        </span>
      </div>
      <progress
        aria-label="Listing steps"
        max={reviewStep + 1}
        value={step + 1}
      />
      <h3 ref={heading} tabIndex={-1}>
        {field?.label || media?.[1] || 'Review your listing'}
      </h3>
      {field && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void next();
          }}
        >
          <p id="listing-step-help">{field.help}</p>
          <label className="workflow-field" htmlFor="listing-step-input">
            <span>
              {field.label}{' '}
              <small>{field.required ? '(Required)' : '(Optional)'}</small>
            </span>
            {field.multiline ? (
              <textarea
                key={field.name}
                id="listing-step-input"
                aria-label={field.label}
                disabled={busy}
                aria-describedby="listing-step-help listing-field-count"
                aria-invalid={!!error}
                aria-errormessage={error ? 'listing-step-error' : undefined}
                rows={7}
                maxLength={field.maxLength || 300}
                value={values[field.name] || ''}
                onChange={(event) => {
                  setError('');
                  onChange(field.name, event.target.value);
                }}
              />
            ) : (
              <input
                key={field.name}
                id="listing-step-input"
                aria-label={field.label}
                disabled={busy}
                aria-describedby="listing-step-help"
                aria-invalid={!!error}
                aria-errormessage={error ? 'listing-step-error' : undefined}
                type={field.type || 'text'}
                required={field.required}
                maxLength={field.maxLength || 300}
                min={
                  field.name === 'year'
                    ? 1903
                    : field.name === 'price'
                      ? 0.01
                      : undefined
                }
                max={
                  field.name === 'year'
                    ? new Date().getUTCFullYear() + 1
                    : field.name === 'price'
                      ? 1000000000
                      : undefined
                }
                step={
                  field.name === 'price'
                    ? 'any'
                    : field.type === 'number'
                      ? 1
                      : undefined
                }
                value={values[field.name] || ''}
                onChange={(event) => {
                  setError('');
                  onChange(field.name, event.target.value);
                }}
              />
            )}
          </label>
          {field.multiline && (
            <p id="listing-field-count" className="workflow-hint">
              {(values[field.name] || '').length.toLocaleString()} /{' '}
              {(field.maxLength || 300).toLocaleString()} characters
            </p>
          )}
          {field.name === 'description' && (
            <DescriptionProofreading
              value={values.description || ''}
              onChange={(value) => onChange('description', value)}
              disabled={busy}
            />
          )}
          {error && (
            <p id="listing-step-error" role="alert" className="workflow-error">
              {error}
            </p>
          )}
          <div className="workflow-actions">
            <button
              type="button"
              disabled={busy || step === 0}
              onClick={() => go(step - 1)}
            >
              Back
            </button>
            <button type="submit" className="workflow-primary" disabled={busy}>
              {busy
                ? 'Saving…'
                : !field.required && !values[field.name]?.trim()
                  ? 'Skip for now'
                  : 'Continue'}
            </button>
          </div>
        </form>
      )}
      {media && (
        <>
          <p>{mediaLimits(media[0])}</p>
          {saved ? (
            renderMedia(media[0])
          ) : (
            <>
              <p>
                Save a private draft to attach files. You can also continue
                without attachments.
              </p>
              <button disabled={busy} onClick={() => void onSave()}>
                Save draft for attachments
              </button>
            </>
          )}
          <div className="workflow-actions">
            <button disabled={busy} onClick={() => go(step - 1)}>
              Back
            </button>
            <button
              className="workflow-primary"
              disabled={busy}
              onClick={() => void next()}
            >
              {mediaCounts[media[0]] ? 'Continue' : 'Skip for now'}
            </button>
          </div>
        </>
      )}
      {review && (
        <>
          <p>
            Check your details before sending this draft for private RWAS
            review. This does not publish the listing.
          </p>
          {missing.length > 0 && (
            <p role="alert" className="workflow-error">
              Complete or correct:{' '}
              {missing.map((item) => item.label).join(', ')}.
            </p>
          )}
          <dl className="workflow-summary">
            {draftFields.map((item, index) => (
              <div key={item.name}>
                <dt>
                  {item.label}
                  {item.required ? ' · Required' : ''}
                </dt>
                <dd>
                  {values[item.name]?.trim() ||
                    (item.required ? 'Missing' : 'Not provided')}
                  <button
                    disabled={busy}
                    onClick={() => go(index)}
                    aria-label={'Edit ' + item.label}
                  >
                    Edit
                  </button>
                </dd>
              </div>
            ))}
            {mediaSteps.map(([category, label], index) => (
              <div key={category}>
                <dt>{label} · Optional</dt>
                <dd>
                  {mediaCounts[category] || 0} files
                  <button
                    disabled={busy}
                    onClick={() => go(draftFields.length + index)}
                    aria-label={'Edit ' + label}
                  >
                    Edit
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          <div className="workflow-actions">
            <button disabled={busy} onClick={() => go(step - 1)}>
              Back
            </button>
            <button
              className="workflow-primary"
              disabled={busy || missing.length > 0}
              onClick={() => void onSubmitReview()}
            >
              {busy ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </>
      )}
      <div className="workflow-footer">
        <button
          disabled={busy}
          onClick={() => {
            if (validateSavedValues()) void onSave();
          }}
        >
          {busy ? 'Saving…' : 'Save Draft'}
        </button>
        {!review && (
          <button disabled={busy} onClick={() => go(reviewStep)}>
            Review draft
          </button>
        )}
        <p className="workflow-hint">
          You can save an incomplete private draft at any step. Choose Save
          Draft before closing; moving between steps keeps your entries in this
          window.
        </p>
      </div>
      <style jsx>{`
        .listing-workflow {
          padding-top: 12px;
        }
        .workflow-intro,
        .workflow-hint {
          color: #53514c;
          font-size: 14px;
          line-height: 1.6;
        }
        .workflow-progress {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
          font-weight: 700;
          margin: 22px 0 10px;
        }
        progress {
          width: 100%;
          height: 8px;
          accent-color: #9a741b;
          appearance: none;
          border: 0;
          border-radius: 4px;
          overflow: hidden;
        }
        progress::-webkit-progress-bar {
          background: #dcd3be;
        }
        progress::-webkit-progress-value {
          background: #9a741b;
        }
        progress::-moz-progress-bar {
          background: #9a741b;
        }
        h3 {
          margin: 26px 0 12px;
          font-family: Arial, sans-serif;
          font-size: 24px;
        }
        h3:focus {
          outline: none;
        }
        h3:focus-visible {
          outline: 2px solid #9a741b;
          outline-offset: 4px;
        }
        p {
          line-height: 1.6;
        }
        .workflow-field {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 24px 0 8px;
          font-weight: 700;
        }
        small {
          font-size: 13px;
          font-weight: 400;
        }
        input,
        textarea {
          box-sizing: border-box;
          width: 100%;
          min-height: 48px;
          border: 1px solid #7b7871;
          border-radius: 4px;
          padding: 12px;
          font:
            16px Arial,
            sans-serif;
          background: #fff;
          color: #222;
        }
        textarea {
          resize: vertical;
        }
        [aria-invalid='true'] {
          border-color: #9b2222;
        }
        button {
          min-height: 44px;
          padding: 10px 16px;
          border: 1px solid #333;
          border-radius: 4px;
          background: #fff;
          color: #222;
          font:
            15px Arial,
            sans-serif;
          cursor: pointer;
          white-space: normal;
        }
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible {
          outline: 2px solid #9a741b;
          outline-offset: 3px;
        }
        button:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .workflow-primary {
          background: #e2bc51;
          font-weight: 700;
        }
        .workflow-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 28px;
        }
        .workflow-error {
          color: #9b2222;
        }
        .workflow-footer {
          border-top: 1px solid #c5bfb4;
          margin-top: 28px;
          padding-top: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .workflow-footer p {
          flex-basis: 100%;
          margin: 0;
        }
        .workflow-summary {
          margin: 24px 0;
        }
        .workflow-summary > div {
          padding: 14px 0;
          border-bottom: 1px solid #d9d3c8;
        }
        dt {
          font-weight: 700;
        }
        dd {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          margin: 8px 0 0;
        }
        dd button {
          display: block;
          margin-top: 10px;
        }
        @media (max-width: 480px) {
          .workflow-progress {
            flex-wrap: wrap;
          }
          .workflow-actions > button {
            flex: 1;
          }
        }
      `}</style>
    </section>
  );
}

function DescriptionProofreading({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [working, setWorking] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    original: string;
    text: string;
  } | null>(null);
  const [applied, setApplied] = useState<{
    original: string;
    text: string;
  } | null>(null);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    generation.current += 1;
    request.current?.abort();
    setWorking(false);
    setSuggestion(null);
    setError('');
    return () => {
      generation.current += 1;
      request.current?.abort();
    };
  }, [value]);
  async function proofread() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const attempt = ++generation.current;
    setWorking(true);
    setError('');
    setSuggestion(null);
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const text = await proofreadDescription(value, controller.signal);
      if (generation.current === attempt)
        setSuggestion({ original: value, text });
    } catch (reason) {
      if (generation.current === attempt)
        setError(
          controller.signal.aborted
            ? 'Jerry took too long. Your description is unchanged. Try again.'
            : reason instanceof TypeError
              ? 'Jerry could not be reached. Your description is unchanged. Try again later.'
              : reason instanceof SyntaxError
                ? 'Jerry’s response could not be read. Your description is unchanged. Try again.'
                : reason instanceof Error
                  ? reason.message
                  : 'Jerry is unavailable. Your description is unchanged.',
        );
    } finally {
      clearTimeout(timeout);
      if (generation.current === attempt) setWorking(false);
    }
  }
  return (
    <div className="proofreading">
      <button
        type="button"
        disabled={disabled || working || !value.trim()}
        onClick={() => void proofread()}
      >
        {working ? 'Jerry is proofreading…' : 'Ask Jerry to proofread'}
      </button>
      {working && (
        <p role="status">
          Preparing a suggestion. Your description stays unchanged until you
          accept it.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {suggestion && (
        <section aria-label="Jerry’s proofreading suggestion">
          <h4>Compare Jerry’s wording</h4>
          <label>
            Original description
            <textarea
              aria-label="Original description"
              readOnly
              rows={5}
              value={suggestion.original}
            />
          </label>
          <label>
            Suggested description
            <textarea
              aria-label="Suggested description"
              readOnly
              rows={5}
              value={suggestion.text}
            />
          </label>
          <p>Check the details, then choose which wording to keep.</p>
          <div className="proofreading-actions">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (value !== suggestion.original) return;
                setApplied(suggestion);
                onChange(suggestion.text);
              }}
            >
              Use Jerry’s suggestion
            </button>
            <button type="button" onClick={() => setSuggestion(null)}>
              Keep my original
            </button>
          </div>
        </section>
      )}
      {applied?.text === value && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(applied.original);
            setApplied(null);
          }}
        >
          Undo Jerry’s edit
        </button>
      )}
      <style jsx>{`
        .proofreading {
          margin: 16px 0;
        }
        button {
          min-height: 44px;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 10px 14px;
          color: #222;
          background: #fff;
          font:
            15px Arial,
            sans-serif;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.55;
          cursor: default;
        }
        button:focus-visible {
          outline: 2px solid #9a741b;
          outline-offset: 3px;
        }
        section {
          background: #eee8dc;
          border: 1px solid #c5bfb4;
          padding: 16px;
          margin-top: 16px;
        }
        h4 {
          font:
            700 18px Arial,
            sans-serif;
          margin: 0 0 16px;
        }
        label {
          display: block;
          margin: 16px 0;
          font-weight: 700;
        }
        textarea {
          box-sizing: border-box;
          display: block;
          width: 100%;
          margin-top: 8px;
          padding: 12px;
          border: 1px solid #888;
          border-radius: 4px;
          font:
            16px Arial,
            sans-serif;
          background: #fff;
          color: #222;
          resize: vertical;
        }
        p {
          font-size: 14px;
          line-height: 1.6;
        }
        [role='alert'] {
          color: #9b2222;
        }
        .proofreading-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}
