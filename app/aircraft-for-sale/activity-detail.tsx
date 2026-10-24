'use client';
import { useEffect, useRef } from 'react';
import JerryResearchPanel, { type JerryResearch } from './jerry-research-panel';
export type ActivityEvent = {
  id: string;
  at: number;
  clientAt?: number;
  requestId: string;
  relatedRequestId?: string;
  actor: { type: string; id: string; email: string };
  action: string;
  result: string;
  source: string;
  status?: number;
  method?: string;
  route: string;
  resourceId?: string;
  durationMs?: number;
  hasConversation?: boolean;
  hasReview?: boolean;
  details: Record<string, unknown>;
};
type Turn = {
  id?: string;
  at?: number;
  source?: string;
  result?: string;
  mode?: string;
  messages: { role: string; content: string }[];
  truncated?: boolean;
  error?: string;
};
export type ActivityDetailData = {
  event: ActivityEvent;
  exchanges?: Turn[];
  conversationUnavailable?: string;
  conversationExpiresAt?: number;
};
export default function ActivityDetail({
  data,
  onClose,
}: {
  data: ActivityDetailData;
  onClose: () => void;
}) {
  const event = data.event;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: 'start' });
  }, [event.id]);
  const { conversation, review, ...metadata } = event.details;
  const turns = data.exchanges?.length
    ? data.exchanges
    : conversation
      ? [
          {
            ...(conversation as Turn),
            at: event.at,
            source: event.source,
            result: event.result,
          },
        ]
      : [];
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      className="activity-detail"
      aria-label="Activity details"
    >
      <header>
        <div>
          <p className="eyebrow">Troubleshooting details</p>
          <h3>{event.action}</h3>
          <p>
            {event.actor.email || 'Account not recorded'} ·{' '}
            {new Date(event.at).toLocaleString()}
          </p>
        </div>
        <button type="button" onClick={onClose}>
          Close activity details
        </button>
      </header>
      <dl className="facts">
        <div>
          <dt>Request ID</dt>
          <dd>{event.requestId}</dd>
        </div>
        <div>
          <dt>UTC timestamp</dt>
          <dd>{new Date(event.at).toISOString()}</dd>
        </div>
        {event.resourceId && (
          <div>
            <dt>Listing / record</dt>
            <dd>{event.resourceId}</dd>
          </div>
        )}
        {event.relatedRequestId && (
          <div>
            <dt>Related request</dt>
            <dd>{event.relatedRequestId}</dd>
          </div>
        )}
      </dl>
      {data.conversationUnavailable && (
        <p className="note">
          Conversation unavailable: {data.conversationUnavailable}
        </p>
      )}
      {!!turns.length && (
        <section aria-label="Jerry conversation transcript">
          <h3>Conversation</h3>
          <p className="note">
            Latest {turns.length} retained exchanges, in time order.
            Browser-reported exchanges are observations; listing-assistant
            exchanges contain the server’s actual reply.
          </p>
          {turns.map((turn, index) => (
            <article className="exchange" key={index}>
              <p className="turn-meta">
                {turn.at ? new Date(turn.at).toLocaleString() : ''} ·{' '}
                {turn.mode === 'listing'
                  ? 'Listing assistant'
                  : 'Marketplace chat'}{' '}
                ·{' '}
                {turn.source === 'server'
                  ? 'Server recorded'
                  : 'Browser reported'}
              </p>
              {turn.messages.map((message, n) => (
                <div
                  key={n}
                  className={`message ${message.role === 'assistant' ? 'jerry' : 'user'}`}
                >
                  <strong>
                    {message.role === 'assistant' ? 'Jerry' : 'User'}
                  </strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {turn.error && <p className="note">{turn.error}</p>}
              {turn.truncated && (
                <p className="note">
                  This exchange was shortened to the troubleshooting storage
                  limit.
                </p>
              )}
            </article>
          ))}
        </section>
      )}
      {!!review && (
        <section aria-label="Jerry review recommendation">
          <h3>
            {event.details.kind === 'account'
              ? 'Account review recommendation'
              : 'Listing review recommendation'}
          </h3>
          <p className="note">
            {event.details.reviewScope === 'current-report'
              ? 'Current saved report. This may differ from a previous recommendation.'
              : 'Snapshot saved when Jerry completed this review.'}
          </p>
          <JerryResearchPanel review={review as JerryResearch} />
        </section>
      )}
      <details>
        <summary>Technical event metadata</summary>
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      </details>
      <style jsx>{`
        .activity-detail {
          margin: 18px 0;
          padding: 20px;
          border: 1px solid #c9b67e;
          border-radius: 8px;
          background: #fffdf7;
          min-width: 0;
        }
        .activity-detail header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }
        .activity-detail h3 {
          margin: 5px 0 10px;
          font-size: 20px;
        }
        .activity-detail p {
          line-height: 1.6;
        }
        .eyebrow {
          font-size: 12px;
          color: #786325;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0;
        }
        .activity-detail button {
          min-height: 44px;
          border: 1px solid #b4afa5;
          border-radius: 5px;
          background: #fff;
          padding: 10px 12px;
          font: inherit;
          color: #25231f;
          cursor: pointer;
        }
        .activity-detail button:focus-visible,
        .activity-detail summary:focus-visible {
          outline: 3px solid #a17c13;
          outline-offset: 3px;
        }
        .facts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          font-size: 13px;
        }
        .facts dt {
          font-weight: 600;
        }
        .facts dd {
          margin: 4px 0;
          overflow-wrap: anywhere;
        }
        .activity-detail section {
          margin-top: 22px;
        }
        .note,
        .turn-meta {
          font-size: 12px;
          color: #655f53;
        }
        .exchange {
          padding: 14px 0;
          border-top: 1px solid #ddd5c3;
        }
        .message {
          padding: 12px 14px;
          margin: 8px 0;
          border: 1px solid #ddd8ce;
          border-radius: 6px;
          background: #fff;
        }
        .message.jerry {
          background: #f3f0e7;
          border-left: 3px solid #a17c13;
        }
        .message p {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          margin: 6px 0 0;
        }
        .activity-detail details {
          margin-top: 18px;
          font-size: 13px;
        }
        .activity-detail summary {
          cursor: pointer;
          min-height: 30px;
        }
        .activity-detail pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          background: #f5f2ec;
          padding: 12px;
          font: 12px/1.6 monospace;
        }
        @media (max-width: 600px) {
          .activity-detail {
            padding: 14px;
          }
          .activity-detail header {
            flex-direction: column;
          }
          .facts {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </aside>
  );
}
