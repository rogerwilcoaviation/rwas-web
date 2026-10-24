'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import ActivityDetail, {
  type ActivityEvent as Event,
  type ActivityDetailData,
} from './activity-detail';
type Response = {
  events: Event[];
  nextCursor: string | null;
  retentionDays: number;
  maxRows: number;
  serverTime: number;
};
type Filters = {
  q: string;
  result: string;
  source: string;
  from: string;
  to: string;
  type: string;
};
const defaults: Filters = {
  q: '',
  result: 'all',
  source: 'all',
  from: '',
  to: '',
  type: 'all',
};
function actionLabel(event: Event) {
  const labels: Record<string, string> = {
    'page.view': 'Page viewed',
    'page.leave': 'Page closed or left',
    'control.click': 'Control selected',
    'field.change': 'Field changed',
    'form.submit': 'Form submitted',
    'draft.step': 'Draft step viewed',
    'chat.request': 'Jerry chat request',
    'client.error': 'Browser error',
    'request.network-error': 'Network request failed',
  };
  const control =
    typeof event.details.control === 'string'
      ? event.details.control.replaceAll('-', ' ')
      : '';
  return (
    (labels[event.action] || event.action) +
    (control && !['button', 'field', 'form', 'link'].includes(control)
      ? ` · ${control}`
      : '') +
    (typeof event.details.step === 'number'
      ? ` · step ${event.details.step + 1}`
      : '')
  );
}
export default function ActivityLog({
  request,
}: {
  request: (path: string, method?: string, body?: unknown) => Promise<unknown>;
}) {
  const [filters, setFilters] = useState(defaults),
    [applied, setApplied] = useState(defaults);
  const [data, setData] = useState<Response | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null),
    [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<ActivityDetailData | null>(null),
    [detailBusy, setDetailBusy] = useState(false),
    [detailError, setDetailError] = useState('');
  const [reports, setReports] = useState<Event[]>([]),
    [reportsBusy, setReportsBusy] = useState(false),
    [reportsError, setReportsError] = useState(''),
    [reportsLoaded, setReportsLoaded] = useState(false);
  const detailGeneration = useRef(0),
    reportsGeneration = useRef(0);
  useEffect(
    () => () => {
      detailGeneration.current++;
      reportsGeneration.current++;
    },
    [],
  );
  const requestRef = useRef(request);
  requestRef.current = request;
  const canonicalId = (
    detail?.event.details.conversationRef as
      | { conversationId?: string }
      | undefined
  )?.conversationId;
  useEffect(() => {
    if (!canonicalId || !expanded) return;
    let active = true,
      epoch = 0,
      deletedHere = false;
    const generation = detailGeneration.current;
    const clear = (reason: string) => {
      epoch++;
      setDetail((current) =>
        current
          ? { ...current, exchanges: [], conversationUnavailable: reason }
          : current,
      );
    };
    const check = async () => {
      if (deletedHere) return;
      const captured = epoch;
      try {
        const current = (await requestRef.current(
          '/admin/activity/' + expanded,
        )) as ActivityDetailData;
        if (
          active &&
          captured === epoch &&
          generation === detailGeneration.current
        )
          setDetail(current);
      } catch {
        if (
          active &&
          captured === epoch &&
          generation === detailGeneration.current
        )
          clear('Refresh required; current access could not be verified.');
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden')
        clear('Hidden while this page is inactive.');
      else void check();
    };
    const deleted = (event: {
      data?: { id?: string };
      detail?: { id?: string };
    }) => {
      if ((event.data?.id || event.detail?.id) === canonicalId) {
        deletedHere = true;
        clear('Deleted or expired.');
      }
    };
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('rwas-jerry-v1')
        : null;
    channel?.addEventListener('message', deleted);
    const onDeleted = (event: unknown) =>
      deleted(event as unknown as { detail?: { id?: string } });
    window.addEventListener('rwas:jerry-deleted', onDeleted);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 10000);
    return () => {
      active = false;
      channel?.close();
      window.clearInterval(timer);
      window.removeEventListener('rwas:jerry-deleted', onDeleted);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [canonicalId, expanded]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    setExpanded(null);
    setDetailBusy(false);
    setReports([]);
    setReportsBusy(false);
    setReportsError('');
    setReportsLoaded(false);
    reportsGeneration.current++;
    setDetail(null);
    setDetailError('');
    detailGeneration.current++;
    const query = new URLSearchParams({
      limit: '50',
      result: applied.result,
      source: applied.source,
      type: applied.type,
    });
    if (applied.q.trim()) query.set('q', applied.q.trim());
    if (applied.from) query.set('from', applied.from + 'T00:00:00.000Z');
    if (applied.to) query.set('to', applied.to + 'T23:59:59.999Z');
    if (cursor) query.set('cursor', cursor);
    void requestRef
      .current('/admin/activity?' + query)
      .then((value) => {
        if (active) setData(value as Response);
      })
      .catch((reason) => {
        if (active) {
          setData(null);
          setError(
            reason instanceof Error
              ? reason.message
              : 'Activity could not be loaded.',
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [applied, cursor, refresh]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setCursor(null);
    setHistory([]);
    setApplied({ ...filters });
  }
  async function openDetails(event: Event) {
    if (expanded === event.id) {
      closeDetails();
      return;
    }
    const generation = ++detailGeneration.current;
    setExpanded(event.id);
    setDetail(null);
    setDetailError('');
    setDetailBusy(true);
    try {
      const value = (await requestRef.current(
        '/admin/activity/' + event.id,
      )) as ActivityDetailData;
      if (generation === detailGeneration.current) setDetail(value);
    } catch (reason) {
      if (generation === detailGeneration.current)
        setDetailError(
          reason instanceof Error
            ? reason.message
            : 'Activity details could not be loaded.',
        );
    } finally {
      if (generation === detailGeneration.current) setDetailBusy(false);
    }
  }
  function closeDetails() {
    detailGeneration.current++;
    setExpanded(null);
    setDetail(null);
    setDetailError('');
    setDetailBusy(false);
  }
  async function loadReports() {
    const generation = ++reportsGeneration.current;
    setReportsBusy(true);
    setReportsError('');
    setReportsLoaded(false);
    try {
      const value = (await requestRef.current(
        '/admin/activity/current?q=' + encodeURIComponent(filters.q.trim()),
      )) as { reports: Event[] };
      if (generation === reportsGeneration.current) {
        setReports(value.reports);
        setReportsLoaded(true);
      }
    } catch (reason) {
      if (generation === reportsGeneration.current)
        setReportsError(
          reason instanceof Error
            ? reason.message
            : 'Research reports could not be loaded.',
        );
    } finally {
      if (generation === reportsGeneration.current) setReportsBusy(false);
    }
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <section
      className="exchange-log"
      aria-label="Aviation Exchange activity log"
    >
      <header>
        <div>
          <p className="eyebrow">Troubleshooting</p>
          <h2>Activity log</h2>
          <p>
            Aviation Exchange interactions only. Server results and
            browser-reported actions are labeled separately.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setCursor(null);
            setHistory([]);
            setRefresh((v) => v + 1);
          }}
        >
          Refresh log
        </button>
      </header>
      <form onSubmit={apply} className="log-filters">
        <label className="log-search">
          Search account, action or request ID
          <input
            type="search"
            maxLength={100}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </label>
        <label>
          Result
          <select
            aria-label="Result"
            value={filters.result}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
          >
            {['all', 'success', 'failure', 'redirect', 'observed'].map((v) => (
              <option key={v} value={v}>
                {v === 'all' ? 'All results' : v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event type
          <select
            aria-label="Event type"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="all">All activity</option>
            <option value="conversation">Jerry conversations</option>
            <option value="review">Jerry recommendations</option>
          </select>
        </label>
        <label>
          Source
          <select
            aria-label="Source"
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          >
            {['all', 'server', 'browser', 'system'].map((v) => (
              <option key={v} value={v}>
                {v === 'all' ? 'All sources' : v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          From date (UTC)
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          Through date (UTC)
          <input
            type="date"
            min={filters.from || undefined}
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
        <button type="submit" disabled={busy}>
          Apply filters
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setFilters(defaults);
            setApplied({ ...defaults });
            setCursor(null);
            setHistory([]);
          }}
        >
          Clear filters
        </button>
      </form>
      {error && (
        <p className="log-error" role="alert">
          {error} Use Refresh log to retry.
        </p>
      )}
      <div className="saved-reports">
        <button
          type="button"
          disabled={reportsBusy}
          onClick={() => void loadReports()}
        >
          Load existing Jerry reports
        </button>
        <span>
          Uses the account / record search above. Shows up to 20 current account
          and listing reports.
        </span>
      </div>
      {reportsError && <p role="alert">{reportsError}</p>}
      {!!reports.length && (
        <ul className="report-list" aria-label="Current Jerry reports">
          {reports.map((report) => (
            <li key={report.id}>
              <span>
                <strong>{report.actor.email || 'Account not recorded'}</strong>{' '}
                · {report.details.kind === 'account' ? 'Account' : 'Listing'} ·{' '}
                {report.resourceId}
              </span>
              <button
                type="button"
                onClick={() => {
                  detailGeneration.current++;
                  setExpanded(report.id);
                  setDetail({ event: report });
                  setDetailBusy(false);
                  setDetailError('');
                }}
              >
                View current recommendation
              </button>
            </li>
          ))}
        </ul>
      )}
      {!reportsBusy &&
        reports.length === 0 &&
        reportsLoaded &&
        !reportsError && <p>No saved reports match this search.</p>}
      {detailBusy && <p role="status">Loading activity details…</p>}
      {detailError && <p role="alert">{detailError}</p>}
      {detail && <ActivityDetail data={detail} onClose={closeDetails} />}
      <p role="status" aria-live="polite">
        {busy
          ? 'Loading activity…'
          : data
            ? `${data.events.length} events shown · newest first · times in ${zone}`
            : ''}
      </p>
      {data && (
        <>
          <div
            className="log-scroll"
            role="region"
            aria-label="Activity events"
            tabIndex={0}
            aria-busy={busy}
          >
            <table>
              <caption className="sr-only">
                Aviation Exchange activity events
              </caption>
              <thead>
                <tr>
                  <th>Date and time</th>
                  <th>User account</th>
                  <th>Action taken</th>
                  <th>Result</th>
                  <th>Source</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <time
                        dateTime={new Date(event.at).toISOString()}
                        title={new Date(event.at).toISOString()}
                      >
                        {new Date(event.at).toLocaleDateString()}
                        <br />
                        {new Date(event.at).toLocaleTimeString()}
                      </time>
                    </td>
                    <td>
                      <strong>
                        {event.actor.email ||
                          (event.actor.type === 'anonymous'
                            ? event.source === 'browser'
                              ? 'Account not recorded'
                              : 'Signed-out visitor'
                            : event.actor.type === 'unresolved'
                              ? 'Account not verified'
                              : event.actor.type === 'system'
                                ? 'Jerry / system'
                                : 'Account')}
                      </strong>
                      {event.actor.id && <small>{event.actor.id}</small>}
                    </td>
                    <td>
                      <strong>{actionLabel(event)}</strong>
                      <small>{event.route}</small>
                    </td>
                    <td>
                      <span className={`result result-${event.result}`}>
                        {event.result}
                      </span>
                      {event.status && (
                        <small>
                          HTTP {event.status}
                          {event.durationMs != null
                            ? ` · ${event.durationMs} ms`
                            : ''}
                        </small>
                      )}
                    </td>
                    <td>
                      {event.source === 'browser'
                        ? 'Browser reported'
                        : event.source === 'system'
                          ? 'System'
                          : 'Server'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="detail-toggle"
                        aria-expanded={expanded === event.id}
                        onClick={() => void openDetails(event)}
                      >
                        {expanded === event.id
                          ? 'Hide details'
                          : event.hasConversation
                            ? 'View conversation'
                            : event.hasReview
                              ? 'View recommendation'
                              : 'View details'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.events.length && (
              <p className="log-empty">No activity matches these filters.</p>
            )}
          </div>
          <div className="log-pagination">
            <button
              type="button"
              disabled={busy || !history.length}
              onClick={() => {
                setCursor(history.at(-1) ?? null);
                setHistory(history.slice(0, -1));
              }}
            >
              Newer events
            </button>
            <span>Page {history.length + 1}</span>
            <button
              type="button"
              disabled={busy || !data.nextCursor}
              onClick={() => {
                setHistory([...history, cursor]);
                setCursor(data.nextCursor);
              }}
            >
              Older events
            </button>
          </div>
          <p className="log-note">
            Logging starts with this update. Retention: {data.retentionDays}{' '}
            days or the latest {data.maxRows.toLocaleString()} events, whichever
            is smaller. Sign-in credentials and verification codes are excluded.
            Marketplace conversations and Jerry review snapshots are retained
            for authorized troubleshooting. Older chat text cannot be
            reconstructed. Browser actions require JavaScript and a working
            connection; signed-out activity has no verified account. Opening an
            email app does not confirm email delivery.
          </p>
        </>
      )}
      <style jsx>{`
        .exchange-log {
          min-width: 0;
          font-family: Arial, sans-serif;
          color: #25231f;
        }
        .exchange-log header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .exchange-log h2 {
          margin: 3px 0 10px;
          font-size: 28px;
        }
        .exchange-log p {
          line-height: 1.6;
        }
        .eyebrow {
          margin: 0;
          color: #786325;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .exchange-log button,
        .exchange-log input,
        .exchange-log select {
          font: inherit;
          min-height: 44px;
          border: 1px solid #b4afa5;
          border-radius: 5px;
          padding: 10px 12px;
          background: #fff;
          color: #25231f;
          max-width: 100%;
          box-sizing: border-box;
        }
        .exchange-log button {
          cursor: pointer;
        }
        .saved-reports {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .saved-reports span {
          font-size: 12px;
          color: #6b665c;
          flex: 1 1 220px;
        }
        .report-list {
          padding: 0;
          list-style: none;
          border: 1px solid #ddd8ce;
          border-radius: 6px;
        }
        .report-list li {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border-bottom: 1px solid #e7e2d9;
          flex-wrap: wrap;
        }
        .report-list span {
          font-size: 13px;
          overflow-wrap: anywhere;
        }
        .exchange-log button:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .exchange-log button:focus-visible,
        .exchange-log input:focus-visible,
        .exchange-log select:focus-visible,
        .log-scroll:focus-visible {
          outline: 3px solid #a17c13;
          outline-offset: 2px;
        }
        .log-filters {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px;
          padding: 18px;
          background: #f5f2ec;
          border: 1px solid #ddd8ce;
          border-radius: 8px;
          margin-top: 16px;
        }
        .log-filters label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          flex: 1 1 140px;
          min-width: 0;
        }
        .log-filters .log-search {
          flex: 2 1 260px;
        }
        .log-filters input,
        .log-filters select {
          width: 100%;
        }
        .log-scroll {
          overflow-x: auto;
          width: 100%;
          border: 1px solid #ddd8ce;
          border-radius: 8px;
        }
        .exchange-log table {
          width: 100%;
          border-collapse: collapse;
          min-width: 840px;
          font-size: 13px;
          text-align: left;
        }
        .exchange-log th {
          padding: 13px;
          background: #f5f2ec;
          border-bottom: 1px solid #d4cec2;
          font-size: 12px;
          white-space: nowrap;
        }
        .exchange-log td {
          padding: 14px 12px;
          border-bottom: 1px solid #e7e2d9;
          vertical-align: top;
          max-width: 320px;
          overflow-wrap: anywhere;
        }
        .exchange-log small {
          display: block;
          color: #6b665c;
          margin-top: 5px;
          font-size: 12px;
        }
        .exchange-log strong {
          font-weight: 600;
        }
        .result {
          display: inline-block;
          padding: 4px 8px;
          background: #ece9e1;
          border-radius: 4px;
          text-transform: capitalize;
        }
        .result-failure {
          background: #fff0ed;
          color: #9e2f20;
        }
        .result-success {
          background: #e8f1e8;
          color: #28532b;
        }
        .detail-toggle {
          text-decoration: underline;
          border: 0 !important;
          padding: 0 !important;
          min-height: 36px !important;
          white-space: nowrap;
        }
        .log-detail {
          min-width: 240px;
          max-width: 340px;
        }
        .log-detail dl {
          margin: 10px 0;
        }
        .log-detail dt {
          font-weight: 600;
          margin-top: 8px;
        }
        .log-detail dd {
          margin: 3px 0;
          overflow-wrap: anywhere;
        }
        .log-detail pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font: 12px/1.5 monospace;
          background: #f5f2ec;
          padding: 10px;
          border-radius: 4px;
        }
        .log-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
        }
        .log-note {
          font-size: 12px;
          color: #6b665c;
        }
        .log-empty {
          padding: 24px;
        }
        .log-error {
          color: #9e2f20;
          background: #fff0ed;
          padding: 12px;
          border-radius: 5px;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
        }
        @media (max-width: 600px) {
          .exchange-log header {
            flex-direction: column;
          }
          .log-filters {
            padding: 12px;
          }
          .log-filters label {
            flex-basis: 100%;
          }
          .log-pagination {
            flex-wrap: wrap;
          }
          .exchange-log h2 {
            font-size: 24px;
          }
        }
      `}</style>
    </section>
  );
}
