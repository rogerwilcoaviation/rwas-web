import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

type Article = {
  id: string;
  status?: string;
  title: string;
  date?: string;
  lead?: string;
  tags?: string[];
};

// Keyword rules matched against article id + title (tags are too broad). Each service page
// links to its most recent supporting articles so topic clusters are
// bidirectional (articles already link back to the service pages).
const RULES: Record<string, RegExp> = {
  'gfc-500-autopilot-installation': /gfc[\s-]?[56]00|autopilot/,
  'g3x-touch-installation': /g3x|\baxis\b|gdl[\s-]?60|flight[\s-]logging/,
  'gtn-xi-navigator-installation':
    /\bgtn\b|\bgns\b|gps[\s-]?175|gnc[\s-]?355|gnx[\s-]?375/,
  'ads-b-installation': /ads-?b|\bgtx\b|transponder|gdl[\s-]?60/,
  'garmin-installation-northern-plains': /garmin/,
  'aircraft-maintenance':
    /service[\s-]bulletins?[\s-]are|repair[\s-]station|electroair|ignition|\brig\b|rigging/,
  'pre-buy-inspection':
    /pre-?buy|service[\s-]bulletins?[\s-]are|repair[\s-]station/,
  'ndt-inspection':
    /\bndt\b|non-?destructive|service[\s-]bulletins?[\s-]are|repair[\s-]station/,
  'rotax-repair': /rotax/,
  'papa-alpha-tools': /papa[\s-]alpha|\brig\b|rigging|\bpiper\b/,
  'fiber-laser-fabrication': /fabrication|laser|uv[\s-]printed|panel[\s-]planner/,
};

function loadPublished(): Article[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'public', 'blog-articles.json'),
      'utf8',
    );
    const data = JSON.parse(raw) as { articles?: Article[] };
    return (data.articles || []).filter((a) => a.status === 'published');
  } catch {
    return [];
  }
}

function clip(text = '', max = 150) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 80 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export default function RelatedReading({ service }: { service: string }) {
  const rule = RULES[service];
  if (!rule) return null;
  const items = loadPublished()
    .filter((a) =>
      rule.test(`${a.id} ${a.title}`.toLowerCase().replace(/-/g, ' ')),
    )
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 4);
  if (!items.length) return null;
  const headingId = `related-reading-${service}`;
  return (
    <section aria-labelledby={headingId} style={{ marginTop: '2rem' }}>
      <span className="bs-kicker">From the RWAS desk</span>
      <h2 id={headingId} className="bs-headline bs-headline--section">
        Related reading
      </h2>
      <hr className="section-rule" />
      <ul className="bs-svc-list">
        {items.map((article) => (
          <li key={article.id} className="bs-svc">
            <p className="bs-svc-name">
              <Link href={`/blog/${article.id}`}>{article.title}</Link>
            </p>
            {article.lead ? (
              <p className="bs-svc-desc">{clip(article.lead)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
