import Link from 'next/link';

export const metadata = {
  title: 'Page not found — Roger Wilco Aviation Services',
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
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(3rem, 10vw, 6rem)',
          fontWeight: 800,
          margin: 0,
          lineHeight: 1,
          color: '#1a1a1a',
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          margin: '1rem 0 0.5rem',
          color: '#1a1a1a',
        }}
      >
        Page not found
      </p>
      <p style={{ color: '#555', maxWidth: '32rem', margin: '0 0 2rem' }}>
        Sorry, we couldn&apos;t find the page you were looking for. It may have moved,
        or the link you followed may be out of date.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: '#1a1a1a',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '0.375rem',
          fontWeight: 600,
        }}
      >
        Back to homepage
      </Link>
    </main>
  );
}
