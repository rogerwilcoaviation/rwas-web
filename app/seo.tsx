import { Metadata } from 'next';
import { siteConfig } from '@/data/config/site.settings';

interface PageSEOProps {
  title: string;
  description: string;
  image?: string;
  canonical: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function genPageMetadata({
  title,
  description,
  image,
  canonical,
  ...rest
}: PageSEOProps): Metadata {
  const socialImage = image || siteConfig.socialBanner;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.title,
      images: [socialImage],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      images: [socialImage],
    },
    alternates: { canonical },
    ...rest,
  };
}
