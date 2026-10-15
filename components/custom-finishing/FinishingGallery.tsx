'use client';
import { useMemo, useState } from 'react';
type Filter = 'all' | 'uv' | 'powder' | 'both';
type Category = 'Aviation' | 'Decorative';
const examples: Array<{
  slot: string;
  title: string;
  category: Category;
  process: Exclude<Filter, 'all'>;
  caption: string;
}> = [
  {
    slot: '01',
    title: 'Aircraft panel legend sample',
    category: 'Aviation',
    process: 'uv',
    caption:
      'Suggested photo: readable markings on a flat panel sample; identify the substrate and note that aircraft applicability requires review.',
  },
  {
    slot: '02',
    title: 'Fabricated shop-tool marking',
    category: 'Aviation',
    process: 'uv',
    caption:
      'Suggested photo: close detail of durable, high-contrast tool graphics.',
  },
  {
    slot: '03',
    title: 'Powder-coated aircraft panel sample',
    category: 'Aviation',
    process: 'powder',
    caption:
      'Suggested photo: coating texture and color on a non-installed sample; do not imply approved aircraft use.',
  },
  {
    slot: '04',
    title: 'Coat + print workflow sample',
    category: 'Aviation',
    process: 'both',
    caption:
      'Suggested photo: a shop sample showing powder-coat finish with UV-printed graphics.',
  },
  {
    slot: '05',
    title: 'Personalized hard-surface sign',
    category: 'Decorative',
    process: 'uv',
    caption: 'Suggested photo: custom color artwork on a flat, rigid item.',
  },
  {
    slot: '06',
    title: 'Decorative metal hardware',
    category: 'Decorative',
    process: 'powder',
    caption:
      'Suggested photo: an assembled non-aviation piece with the finish clearly visible.',
  },
  {
    slot: '07',
    title: 'Branded display plate',
    category: 'Decorative',
    process: 'both',
    caption:
      'Suggested photo: finished color coat and printed logo on one item.',
  },
  {
    slot: '08',
    title: 'Small-batch comparison',
    category: 'Decorative',
    process: 'both',
    caption:
      'Suggested photo: several real customer-approved samples showing color or artwork variations.',
  },
];
const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All examples' },
  { value: 'uv', label: 'UV printing' },
  { value: 'powder', label: 'Powder coating' },
  { value: 'both', label: 'Both processes' },
];
export default function FinishingGallery() {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = useMemo(
    () =>
      examples.filter(
        (example) => filter === 'all' || example.process === filter,
      ),
    [filter],
  );
  return (
    <section className="finishing-gallery" aria-labelledby="gallery-title">
      <div className="finishing-section-heading">
        <div>
          <span className="bs-kicker">Portfolio framework</span>
          <h2 id="gallery-title" className="bs-headline bs-headline--section">
            Real work will live here.
          </h2>
        </div>
        <p className="finishing-intro">
          These are intentionally labeled photo placements—not stock photography
          and not AI-generated portfolio work.
        </p>
      </div>
      <div className="finishing-filter" aria-label="Filter gallery examples">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {visible.length} gallery placements.
      </p>
      <div className="finishing-gallery-grid">
        {visible.map((example) => (
          <article className="finishing-placeholder-card" key={example.slot}>
            <div
              className="finishing-placeholder"
              role="img"
              aria-label={`Photo placement ${example.slot}: ${example.title}. Real shop photo needed.`}
            >
              <span>Photo placement {example.slot}</span>
              <strong>{example.title}</strong>
              <small>Awaiting real RWAS photography</small>
            </div>
            <div className="finishing-placeholder-copy">
              <div>
                <span>{example.category}</span>
                <span>
                  {example.process === 'uv'
                    ? 'UV printing'
                    : example.process === 'powder'
                      ? 'Powder coating'
                      : 'UV + powder'}
                </span>
              </div>
              <p>{example.caption}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
