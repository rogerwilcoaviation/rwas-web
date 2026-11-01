import {
  conditionRatingLabels,
  conditionReport,
} from '@/lib/marketplace/schema.mjs';

export function ConditionStars({
  rating,
  label = 'Condition',
}: {
  rating: number | null;
  label?: string;
}) {
  if (rating === null) return <span>Not rated</span>;
  const description = conditionRatingLabels[rating];
  return (
    <span
      role="img"
      aria-label={`${label}: ${rating} of 5 stars — ${description}`}
      style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35em' }}
    >
      <span aria-hidden="true" style={{ color: '#7a5a1e', letterSpacing: 1 }}>
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </span>
      <span aria-hidden="true">
        {rating}/5 — {description}
      </span>
    </span>
  );
}

export function ConditionReport({
  fields,
  compact = false,
  headingLevel = 3,
}: {
  fields: object;
  compact?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  const rows = conditionReport(fields).filter(
    (row: { rating: number | null }) => !compact || row.rating !== null,
  );
  if (!rows.length) return null;
  const Heading = headingLevel === 2 ? 'h2' : headingLevel === 4 ? 'h4' : 'h3';
  return (
    <div
      className={`listing-condition-report${compact ? ' listing-condition-report--compact' : ''}`}
      aria-label="Seller-reported condition"
      style={{ marginTop: compact ? 12 : 0, minWidth: 0 }}
    >
      {compact ? (
        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#514b40' }}>
          Seller-reported condition
        </p>
      ) : (
        <>
          <Heading style={{ margin: '0 0 10px' }}>Condition report</Heading>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#514b40' }}>
            Seller-reported ratings. 1 star: Poor · 5 stars: Excellent.
          </p>
        </>
      )}
      <dl style={{ margin: 0, display: 'grid', gap: compact ? 6 : 14 }}>
        {rows.map(
          (row: {
            side: string;
            label: string;
            rating: number | null;
            notes: string;
          }) => (
            <div key={row.side} style={{ minWidth: 0 }}>
              <dt style={{ fontWeight: 700, fontSize: compact ? 12 : 14 }}>
                {row.label}
              </dt>
              <dd style={{ margin: '3px 0 0', fontSize: compact ? 13 : 15 }}>
                <ConditionStars rating={row.rating} label={row.label} />
                {!compact && row.notes ? (
                  <p
                    style={{
                      margin: '7px 0 0',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      fontWeight: 400,
                    }}
                  >
                    {row.notes}
                  </p>
                ) : null}
              </dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}
