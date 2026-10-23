'use client';
export type JerryResearch = {
  status: string;
  recommendation?: string;
  summary?: string;
  completedAt?: number;
  findings?: string[];
  aiUnavailable?: boolean;
  evidence?: Record<
    string,
    {
      status: string;
      summary: string;
      url?: string;
      title?: string;
      excerpt?: string;
      sources?: string[];
      matches?: Record<string, string>;
      aircraft?: Record<string, string | null>;
      domain?: string;
    }
  >;
};
const source = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};
export default function JerryResearchPanel({
  review,
  onRefresh,
  disabled = false,
}: {
  review?: JerryResearch;
  onRefresh?: () => void;
  disabled?: boolean;
}) {
  return (
    <section
      className="jerry-research"
      aria-label="Jerry research and recommendation"
    >
      <div className="research-heading">
        <h3>Jerry’s research</h3>
        {onRefresh && (
          <button type="button" disabled={disabled} onClick={onRefresh}>
            Research again
          </button>
        )}
      </div>
      <p className="research-authority">
        Advisory only. Administrators make the approval decision. Verified
        accounts remain usable while research runs.
      </p>
      {!review ? (
        <p>No research report yet.</p>
      ) : (
        <>
          <p role="status">
            <strong>
              {review.status === 'queued'
                ? 'Research queued'
                : review.status === 'researching'
                  ? 'Jerry is researching…'
                  : review.status === 'stale'
                    ? 'Report needs a fresh review'
                    : review.recommendation === 'ready_for_admin'
                      ? 'Ready for administrator review'
                      : 'Administrator attention recommended'}
            </strong>
          </p>
          {review.completedAt && (
            <p className="research-time">
              Checked {new Date(review.completedAt).toLocaleString()}
            </p>
          )}
          {review.summary && <p>{review.summary}</p>}
          {!!review.findings?.length && (
            <ul>
              {review.findings.map((finding, index) => (
                <li key={index}>{finding}</li>
              ))}
            </ul>
          )}
          <div className="research-evidence">
            {Object.entries(review.evidence || {}).map(([name, check]) => (
              <article key={name}>
                <h4>
                  {name === 'email'
                    ? 'Email domain'
                    : name === 'business'
                      ? 'Business website'
                      : 'FAA aircraft registry'}
                </h4>
                <p className="research-state">
                  {check.status.replaceAll('_', ' ')}
                </p>
                {check.domain && <p>{check.domain}</p>}
                <p>{check.summary}</p>
                {check.aircraft && (
                  <dl>
                    {Object.entries(check.aircraft)
                      .filter(([, value]) => value)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                )}
                {check.matches && (
                  <ul>
                    {Object.entries(check.matches).map(([key, value]) => (
                      <li key={key}>
                        {key}:{' '}
                        {value === 'match'
                          ? 'matches FAA data'
                          : 'differs from FAA data — investigate'}
                      </li>
                    ))}
                  </ul>
                )}
                {check.excerpt && (
                  <details>
                    <summary>
                      Collected website excerpt
                      {check.title ? ' — ' + check.title : ''}
                    </summary>
                    <p>{check.excerpt}</p>
                  </details>
                )}
                {!!check.sources?.length && (
                  <ul>
                    {check.sources.map(
                      (url, index) =>
                        source(url) && (
                          <li key={index}>
                            <a
                              href={source(url)!}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                            >
                              Open research source {index + 1}
                            </a>
                          </li>
                        ),
                    )}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <style jsx>{`
        .jerry-research {
          margin: 20px 0;
          padding: 20px;
          border: 1px solid #d6d0c3;
          background: #faf9f5;
          font-family: Arial, sans-serif;
          overflow-wrap: anywhere;
        }
        .research-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .jerry-research h3 {
          margin: 0;
          font-family: Arial, sans-serif;
          font-size: 20px;
        }
        .jerry-research h4 {
          font-family: Arial, sans-serif;
          font-size: 17px;
          margin: 0 0 8px;
        }
        .research-authority,
        .research-time,
        .research-state {
          font-size: 13px;
          color: #5a5955;
        }
        .research-evidence {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(220px, 100%), 1fr)
          );
          gap: 14px;
        }
        .research-evidence article {
          padding: 14px;
          background: white;
          border: 1px solid #ddd;
        }
        .jerry-research p {
          line-height: 1.55;
          margin: 10px 0;
        }
        .jerry-research button {
          padding: 10px 14px;
          min-height: 44px;
          background: white;
          border: 1px solid #555;
          font: inherit;
          cursor: pointer;
        }
        .jerry-research a {
          text-decoration: underline;
        }
        .jerry-research dl div {
          margin: 8px 0;
        }
        .jerry-research dt {
          font-weight: bold;
        }
        .jerry-research dd {
          margin: 2px 0;
        }
        .jerry-research details {
          margin-top: 12px;
        }
        .jerry-research summary {
          cursor: pointer;
        }
      `}</style>
    </section>
  );
}
