'use client';

import dynamic from 'next/dynamic';

const SellerAuthPanel = dynamic(() => import('./seller-auth-panel'), {
  ssr: false,
  loading: () => null,
});

export default function SellerAuthPanelLoader() {
  return <SellerAuthPanel />;
}
