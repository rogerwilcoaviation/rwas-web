import type { Metadata } from 'next';
import SellerAccounts from './SellerAccounts';

export const metadata: Metadata = {
  title: 'Seller account administration',
  robots: { index: false, follow: false },
};

export default function SellerAccountsPage() {
  return <SellerAccounts />;
}
