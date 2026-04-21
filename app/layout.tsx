import { Nunito_Sans } from 'next/font/google';
import { siteConfig } from '@/data/config/site.settings';
import { ThemeProviders } from './theme-providers';
import { Metadata } from 'next';
import Script from 'next/script';

import { colors } from '@/data/config/colors.js';

import '@/css/globals.css';
import './broadsheet-tokens.css';
import './broadsheet-chrome.css';
import { SearchProvider } from '@/components/shared/SearchProvider';
import { AnalyticsWrapper } from '@/components/shared/Analytics';

const displayFont = Nunito_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-display',
});

const baseFont = Nunito_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-default',
});

const globalColors = colors;
const style: string[] = [];

Object.keys(globalColors).map((variant) => {
  return Object.keys(globalColors[variant]).map((color) => {
    const value = globalColors[variant][color];
    style.push(`--${variant}-${color}: ${value}`);
  });
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.title}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: './',
    siteName: siteConfig.title,
    images: [siteConfig.socialBanner],
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: './',
    types: {
      'application/rss+xml': `${siteConfig.siteUrl}/feed.xml`,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  twitter: {
    title: siteConfig.title,
    card: 'summary_large_image',
    images: [siteConfig.socialBanner],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang={siteConfig.language}
      className={`${baseFont.variable} ${displayFont.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <style>
          {`
          :root, :before, :after {
            ${style.join(';')}
          }
        `}
        </style>

        <link
          rel="apple-touch-icon"
          sizes="76x76"
          href="/static/favicons/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/static/favicons/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/static/favicons/favicon-16x16.png"
        />
        <link rel="manifest" href="/static/favicons/manifest.webmanifest" />
        <link
          rel="mask-icon"
          href="/static/favicons/safari-pinned-tab.svg"
          color="#5bbad5"
        />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#fff"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#000"
        />
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
        {/* Schema.org LocalBusiness + Organization (P2.1) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': ['LocalBusiness', 'AutomotiveBusiness'],
                  '@id': `${siteConfig.siteUrl}#organization`,
                  name: 'Roger Wilco Aviation Services',
                  alternateName: 'RWAS',
                  url: siteConfig.siteUrl,
                  logo: `${siteConfig.siteUrl}/newspaper/images/logo.png`,
                  image: `${siteConfig.siteUrl}/newspaper/images/r182_panel.jpg`,
                  description:
                    'FAA Part 145 Repair Station (Certificate RWSR491E) in Yankton, South Dakota. Certified Garmin dealer specializing in G3X Touch, GFC 500, GTN navigators, annual inspections, NDT, sheet metal fabrication, and Papa-Alpha Piper rigging tools.',
                  telephone: '+1-605-299-8178',
                  email: 'avionics@rwas.team',
                  priceRange: '$$',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '700 E 31st Street',
                    addressLocality: 'Yankton',
                    addressRegion: 'SD',
                    postalCode: '57078',
                    addressCountry: 'US',
                  },
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: 42.9167,
                    longitude: -97.3858,
                  },
                  openingHoursSpecification: [
                    {
                      '@type': 'OpeningHoursSpecification',
                      dayOfWeek: [
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                      ],
                      opens: '07:00',
                      closes: '17:00',
                    },
                  ],
                  areaServed: [
                    { '@type': 'State', name: 'South Dakota' },
                    { '@type': 'State', name: 'Nebraska' },
                    { '@type': 'State', name: 'Iowa' },
                    { '@type': 'State', name: 'Minnesota' },
                    { '@type': 'State', name: 'North Dakota' },
                    { '@type': 'State', name: 'Wyoming' },
                    { '@type': 'State', name: 'Montana' },
                  ],
                  hasCredential: [
                    {
                      '@type': 'EducationalOccupationalCredential',
                      credentialCategory:
                        'FAA Part 145 Repair Station Certificate',
                      recognizedBy: {
                        '@type': 'Organization',
                        name: 'Federal Aviation Administration',
                      },
                      identifier: 'RWSR491E',
                    },
                  ],
                  memberOf: [
                    { '@type': 'Organization', name: 'NBAA' },
                    { '@type': 'Organization', name: 'AEA' },
                  ],
                  sameAs: [
                    'https://www.facebook.com/rogerwilcoaviationservices/',
                    'https://aea.net/memberdetails.asp?ID=3310',
                    'https://www.aopa.org/destinations/business/39868',
                    'https://www.bbb.org/us/sd/yankton/profile/aviation-services/roger-wilco-aviation-services-llc-0714-1000062719',
                    'https://business.yanktonsd.com/list/member/roger-wilco-aviation-services-6940',
                  ],
                  founder: {
                    '@type': 'Person',
                    name: 'John Halsted',
                    jobTitle: 'Owner & Chief A&P / IA Mechanic',
                  },
                },
                {
                  '@type': 'WebSite',
                  '@id': `${siteConfig.siteUrl}#website`,
                  url: siteConfig.siteUrl,
                  name: 'Roger Wilco Aviation Services',
                  publisher: { '@id': `${siteConfig.siteUrl}#organization` },
                  inLanguage: 'en-US',
                },
              ],
            }),
          }}
        />
      </head>

      <body className="flex flex-col bg-white text-black antialiased dark:bg-gray-950 dark:text-white min-h-screen">
        <Script src="/jerry-widget.js" strategy="afterInteractive" />
        <ThemeProviders>
          <AnalyticsWrapper />

          <div className="w-full flex flex-col justify-between items-center font-sans">
            <SearchProvider>
              <main className="w-full flex flex-col items-center mb-auto">
                {children}
              </main>
            </SearchProvider>
          </div>
        </ThemeProviders>
      </body>
    </html>
  );
}
