'use client';
import { useEffect, useState } from 'react';
type Contact = {
  email: string;
  title: string;
  tailNumber: string;
  location: string;
};
export default function ContactSeller({
  listingId,
  request,
}: {
  listingId: string;
  request: (path: string) => Promise<unknown>;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void request('/buyer/contact/' + encodeURIComponent(listingId))
      .then((value) => {
        if (!active) return;
        const data = value as Contact;
        if (
          !data ||
          typeof data.email !== 'string' ||
          !/^\S+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
          /[\r\n]/.test(data.email) ||
          typeof data.title !== 'string'
        )
          throw Error('Seller contact is unavailable.');
        setContact(data);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Seller contact is unavailable.',
          );
      });
    return () => {
      active = false;
    };
    // The parent request is bound to the current authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);
  const subject = contact
    ? 'Aircraft4Sale inquiry: ' +
      contact.title +
      (contact.tailNumber ? ' (' + contact.tailNumber + ')' : '')
    : '';
  const body = contact
    ? `Hello,\n\nI would like more information about ${contact.title}${contact.tailNumber ? ' (' + contact.tailNumber + ')' : ''}${contact.location ? ' located in ' + contact.location : ''}.\n\nListing: ${window.location.origin}/aircraft-for-sale/${encodeURIComponent(listingId)}\n\nMy questions:\n\n`
    : '';
  return (
    <section
      className="seller-contact-panel"
      aria-label="Contact the listing seller"
    >
      {error ? (
        <p role="alert">{error}</p>
      ) : !contact ? (
        <p role="status">Finding the seller’s verified contact address…</p>
      ) : (
        <>
          <h3>{contact.title}</h3>
          {contact.tailNumber && <p>Tail number: {contact.tailNumber}</p>}
          {contact.location && (
            <p>Aircraft or item location: {contact.location}</p>
          )}
          <p>
            Ask the seller about condition, availability, records or other
            listing details.
          </p>
          <a
            className="email-seller-action"
            href={
              'mailto:' +
              encodeURIComponent(contact.email) +
              '?subject=' +
              encodeURIComponent(subject) +
              '&body=' +
              encodeURIComponent(body)
            }
          >
            Email seller
          </a>
          <p className="contact-help">
            This opens your email app. Review and send the message there.
            Replies will go to the email address you send from.
          </p>
          <p>Seller contact: {contact.email}</p>
        </>
      )}
      <style jsx>{`
        section {
          font:
            15px/1.6 Arial,
            sans-serif;
          padding-top: 16px;
        }
        h3 {
          font-size: 22px;
          margin: 0 0 16px;
        }
        .email-seller-action {
          display: inline-block;
          padding: 12px 20px;
          border: 1px solid #94771a;
          border-radius: 4px;
          background: #b99727;
          color: #19180f;
          font-weight: 600;
          text-decoration: none;
        }
        .email-seller-action:focus-visible {
          outline: 3px solid #8b6c0a;
          outline-offset: 3px;
        }
        .contact-help {
          color: #6d665a;
          font-size: 13px;
        }
        p {
          overflow-wrap: anywhere;
        }
      `}</style>
    </section>
  );
}
