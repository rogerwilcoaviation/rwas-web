import {
  BroadsheetLayout,
  Dateline,
  Masthead,
  BroadsheetNav,
  CredentialsBar,
  BulletinBar,
  BroadsheetFooter,
} from '@/components/shared/broadsheet';
import CartClient from '@/components/shopify/CartClient';

export const metadata = {
  title: 'RWAS Cart',
  description: 'Review your RWAS Shopify cart and continue to checkout.',
};

export default function CartPage() {
  return (
    <BroadsheetLayout>
      <Dateline />
      <Masthead />
      <BroadsheetNav activeHref="/cart" />
      <CredentialsBar />
      <BulletinBar />
      <main className="bs-stage">
        <section className="hero-headline-group">
          <p className="bs-kicker">The Order Desk</p>
          <p className="bs-script-accent">&mdash; review &amp; complete your selection &mdash;</p>
          <h1 className="bs-headline bs-headline--hero">Your cart.</h1>
          <p className="bs-subhead">
            Adjust quantities, remove items, then hand off to Shopify checkout when ready.
          </p>
          <p className="bs-byline">
            RWAS Avionics Desk &middot; Yankton, SD &middot; KYKN
          </p>
        </section>

        <CartClient />
      </main>
      <BroadsheetFooter />
    </BroadsheetLayout>
  );
}
