'use client';
import { FormEvent, useMemo, useState } from 'react';
declare global {
  interface Window {
    openJerryChat?: () => void;
  }
}
const serviceChoices = [
  'UV printing',
  'Powder coating',
  'Both',
  'Not sure',
] as const;
const objectPrompts = [
  'Aircraft panel/sample',
  'Sign or display',
  'Tool or fixture',
  'Decorative item',
  'Other',
];
const materialPrompts = [
  'Aluminum/metal',
  'Plastic/acrylic',
  'Wood/composite',
  'Already coated',
  'Not sure',
];
export default function FinishingInquiry({
  defaultService = 'Not sure',
}: {
  defaultService?: (typeof serviceChoices)[number];
}) {
  const [service, setService] =
    useState<(typeof serviceChoices)[number]>(defaultService);
  const [objectType, setObjectType] = useState('');
  const [material, setMaterial] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [quantity, setQuantity] = useState('');
  const [artwork, setArtwork] = useState('');
  const [finish, setFinish] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const summary = useMemo(
    () =>
      [
        ['Service interest', service],
        ['Object / project', objectType],
        ['Material', material],
        ['Overall dimensions', dimensions],
        ['Quantity', quantity],
        ['Artwork / markings', artwork],
        ['Desired finish', finish],
        ['Needed-by date', neededBy],
        ['Question / context', question],
        ['Name', name],
        ['Email', email],
        ['Phone', phone],
      ]
        .filter(([, value]) => value.trim())
        .map(([label, value]) => `${label}: ${value.trim()}`)
        .join('\n'),
    [
      service,
      objectType,
      material,
      dimensions,
      quantity,
      artwork,
      finish,
      neededBy,
      question,
      name,
      email,
      phone,
    ],
  );
  function openDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!objectType.trim()) {
      setError(
        'Tell us what the item or project is before opening the email draft.',
      );
      document.getElementById('finishing-object')?.focus();
      return;
    }
    setError('');
    const subject = `Printing or coating inquiry — ${service}`;
    const body = `Hello RWAS,\n\nI would like a compatibility and quote review for the printing or coating work described below.\n\n${summary}\n\nI understand material suitability, preparation, capacity, schedule, and any aviation applicability must be confirmed before quoting.\n\nI will attach photos or artwork to this email if available.`;
    window.location.href = `mailto:service@rwas.team?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return (
    <section
      id="inquiry"
      className="finishing-inquiry"
      aria-labelledby="inquiry-title"
    >
      <div className="finishing-inquiry-lead">
        <span className="bs-kicker">Start with the item</span>
        <h2 id="inquiry-title" className="bs-headline bs-headline--section">
          Ask About UV Printing &amp; Powder Coating
        </h2>
        <p>
          This inquiry is only for printing and coating jobs. Give the shop
          enough context to evaluate fit. No instant price, lead time, material
          compatibility, aircraft approval, or production slot is promised here.
        </p>
        <div className="finishing-question-card">
          <strong>Not sure where to begin?</strong>
          <ul>
            <li>What is the object, and what is it made from?</li>
            <li>What are its overall length, width, and height?</li>
            <li>
              Is this decorative, functional, or intended for aircraft
              installation?
            </li>
            <li>Do you already have artwork, colors, or a finish in mind?</li>
          </ul>
          <button
            type="button"
            className="finishing-jerry-button"
            onClick={() => window.openJerryChat?.()}
          >
            Ask Captain Jerry
          </button>
          <small>
            Captain Jerry can help collect context. Chat does not submit a
            service request or confirm capability.
          </small>
        </div>
      </div>
      <form className="finishing-form" onSubmit={openDraft} noValidate>
        <fieldset>
          <legend>Which service might fit?</legend>
          <div className="finishing-choice-grid">
            {serviceChoices.map((choice) => (
              <button
                type="button"
                key={choice}
                aria-pressed={service === choice}
                onClick={() => setService(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="finishing-object">
          What is the item or project? <span aria-hidden="true">*</span>
        </label>
        <input
          id="finishing-object"
          value={objectType}
          onChange={(e) => setObjectType(e.target.value)}
          required
          placeholder="Example: small flat aluminum display plate"
        />
        <div className="finishing-chips" aria-label="Example item types">
          {objectPrompts.map((prompt) => (
            <button
              type="button"
              key={prompt}
              onClick={() => setObjectType(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <label htmlFor="finishing-material">Material, if known</label>
        <input
          id="finishing-material"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="Be as specific as you can"
        />
        <div className="finishing-chips" aria-label="Example materials">
          {materialPrompts.map((prompt) => (
            <button
              type="button"
              key={prompt}
              onClick={() => setMaterial(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="finishing-two-col">
          <div>
            <label htmlFor="finishing-dimensions">Overall dimensions</label>
            <input
              id="finishing-dimensions"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="L × W × H and units"
            />
          </div>
          <div>
            <label htmlFor="finishing-quantity">Quantity</label>
            <input
              id="finishing-quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              placeholder="1, 10, 100…"
            />
          </div>
        </div>
        <label htmlFor="finishing-artwork">Artwork or markings</label>
        <textarea
          id="finishing-artwork"
          value={artwork}
          onChange={(e) => setArtwork(e.target.value)}
          rows={3}
          placeholder="Vector art, logo, text, color references, or nothing yet"
        />
        <div className="finishing-two-col">
          <div>
            <label htmlFor="finishing-finish">Desired color / finish</label>
            <input
              id="finishing-finish"
              value={finish}
              onChange={(e) => setFinish(e.target.value)}
              placeholder="Color, sheen, texture, or unsure"
            />
          </div>
          <div>
            <label htmlFor="finishing-date">Needed-by date</label>
            <input
              id="finishing-date"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </div>
        </div>
        <label htmlFor="finishing-question">Question or other context</label>
        <textarea
          id="finishing-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder="Use, current condition, environmental exposure, aircraft context, or anything else the shop should review"
        />
        <fieldset>
          <legend>
            Contact details <span>(optional in this draft)</span>
          </legend>
          <div className="finishing-two-col">
            <div>
              <label htmlFor="finishing-name">Name</label>
              <input
                id="finishing-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="finishing-email">Email</label>
              <input
                id="finishing-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="finishing-phone">Phone</label>
          <input
            id="finishing-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </fieldset>
        <div className="finishing-upload-note">
          <strong>Photos and artwork:</strong> secure direct upload is not wired
          into this preview. After the draft opens, attach files in your email
          app. Nothing is uploaded or sent from this page.
        </div>
        {error ? (
          <p className="finishing-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="finishing-submit">
          Request a Printing or Coating Quote
        </button>
        <p className="finishing-submit-note">
          This opens your email app with a prepared summary addressed to
          service@rwas.team. Review it, add attachments, and choose Send
          yourself.
        </p>
      </form>
    </section>
  );
}
