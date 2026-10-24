type ServiceStructuredDataProps = {
  name: string;
  description: string;
  path: string;
  parent?: { name: string; path: string };
};

export function ServiceStructuredData({
  name,
  description,
  path,
  parent,
}: ServiceStructuredDataProps) {
  const siteUrl = 'https://www.rogerwilcoaviation.com';
  const pageUrl = siteUrl + path;
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    ...(parent ? [parent] : []),
    { name, path },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Service',
              '@id': pageUrl + '#service',
              name,
              description,
              url: pageUrl,
              serviceType: name,
              provider: { '@id': siteUrl + '#organization' },
              areaServed: { '@type': 'Place', name: 'Yankton, South Dakota' },
            },
            {
              '@type': 'WebPage',
              '@id': pageUrl + '#webpage',
              url: pageUrl,
              name,
              description,
              inLanguage: 'en-US',
              isPartOf: { '@id': siteUrl + '#website' },
              mainEntity: { '@id': pageUrl + '#service' },
              breadcrumb: { '@id': pageUrl + '#breadcrumb' },
            },
            {
              '@type': 'BreadcrumbList',
              '@id': pageUrl + '#breadcrumb',
              itemListElement: breadcrumbs.map((item, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: item.name,
                item: siteUrl + item.path,
              })),
            },
          ],
        }).replace(/</g, '\\u003c'),
      }}
    />
  );
}
