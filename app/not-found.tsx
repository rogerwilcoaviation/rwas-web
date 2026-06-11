import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
  description: 'The page you requested could not be found at Roger Wilco Aviation Services.',
};

/**
 * Minimal 404 page — intentionally does NOT import the site Header/Footer
 * components, because doing so would drag the entire shared-component tree
 * (search provider, dynamic menus, mobile nav, social links, cart floater)
 * into the not-found chunk. That chunk is loaded by Next.js's App Router
 * for every page so the client knows how to render a 404 if navigation
 * hits an unmatched route.
 *
 * This standalone page renders without any chrome. Users get a clear
 * message and a link home. Header/Footer reappear on subsequent navigation
 * because they live in the root layout, which is preserved on client-side
 * route changes.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
        background: '#f2ece1',
        color: '#1f1a16',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 'min(42rem, 100%)',
          borderTop: '3px double #1f1a16',
          borderBottom: '1px solid rgba(31, 26, 22, 0.45)',
          height: 8,
          marginBottom: '1.75rem',
        }}
      />
      <h1
        style={{
          fontSize: 'clamp(3.5rem, 12vw, 7rem)',
          fontWeight: 700,
          margin: 0,
          lineHeight: 0.9,
          letterSpacing: 0,
          color: '#1f1a16',
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: 'clamp(1.35rem, 4vw, 2.25rem)',
          fontWeight: 700,
          margin: '1rem 0 0.75rem',
          color: '#1f1a16',
        }}
      >
        Page not found
      </p>
      <p
        style={{
          color: '#423931',
          maxWidth: '34rem',
          margin: '0 0 2rem',
          fontSize: '1.05rem',
          lineHeight: 1.6,
        }}
      >
        Sorry, we couldn&apos;t find the page you were looking for. It may have moved,
        or the link you followed may be out of date.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.4rem',
          borderTop: '1px solid #1f1a16',
          borderBottom: '3px double #1f1a16',
          color: '#1f1a16',
          textDecoration: 'none',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Back to homepage
      </Link>
      <div
        aria-hidden="true"
        style={{
          width: 'min(42rem, 100%)',
          borderTop: '1px solid rgba(31, 26, 22, 0.45)',
          borderBottom: '3px double #1f1a16',
          height: 8,
          marginTop: '2rem',
        }}
      />
    </main>
  );
}
