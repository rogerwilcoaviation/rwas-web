import articleData from '../../public/blog-articles.json';

type Article = {
  id: string;
  status: string;
  date: string;
  category: string;
  title: string;
  lead: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  'press-release': 'Press Release',
  'service-bulletin': 'Service Bulletin',
  'product-update': 'Product Update',
  memo: 'Dealer Memo',
  regulatory: 'Regulatory',
};

export default function BlogArticlesFeed() {
  const articles = ((articleData as { articles?: Article[] }).articles || [])
    .filter((article) => article.status === 'published')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (!articles.length) {
    return null;
  }

  return (
    <>
      {articles.map((a, i) => {
        const label = CATEGORY_LABELS[a.category] || a.category;
        const url = '/blog/' + encodeURIComponent(a.id);
        const lead =
          a.lead.length > 200 ? a.lead.substring(0, 200) + '\u2026' : a.lead;
        return (
          <div key={a.id}>
            <span className="bs-kicker">{label}</span>
            <a href={url}>
              <h3 className="bs-headline bs-headline--section">{a.title}</h3>
            </a>
            <hr className="section-rule" />
            <p className="bs-body">{lead}</p>
            {i < articles.length - 1 && (
              <hr className="section-rule" style={{ marginTop: 18 }} />
            )}
          </div>
        );
      })}
    </>
  );
}
