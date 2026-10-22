import { Metadata } from 'next';
import { siteConfig } from '@/data/config/site.settings';

interface PageSEOProps {
  title: string;
  description: string;
  image?: string;
  canonical: string;
  locale?: string;
  languages?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function genPageMetadata({
  title,
  description,
  image,
  canonical,
  locale = 'en_US',
  languages,
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
      locale,
      type: 'website',
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      images: [socialImage],
    },
    alternates: { canonical, ...(languages ? { languages } : {}) },
    ...rest,
  };
}
