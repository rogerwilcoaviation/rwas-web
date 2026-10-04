import type { Metadata } from 'next';
import SellerReview from './SellerReview';

export const metadata: Metadata = {
  title: 'Aircraft listing review',
  robots: { index: false, follow: false },
};

export default function SellerReviewPage() {
  return <SellerReview />;
}
