'use client';
import { useEffect, useState } from 'react';
import { marketplaceStaffFetch } from '@/lib/marketplace-staff-fetch';

export type NotificationReceipt = {
  listingId: string;
  revision: number;
  submittedAt: number;
  test?: boolean;
  kind?: string;
  decision?: string;
  notificationId?: string;
  channels: Record<
    string,
    { status: string; attempts: number; code: string; at: number }
  >;
};
const labels: Record<string, string> = {
  queued: 'Queued',
  sending: 'Sending',
  claimed: 'Sending',
  delivered: 'Accepted for delivery',
  retry: 'Retry scheduled',
  paused: 'Delivery paused',
  needs_review: 'Needs attention',
};
export function NotificationSummary({
  receipt,
}: {
  receipt?: NotificationReceipt | null;
}) {
  if (!receipt) return null;
  return (
    <p className="admin-muted">
      Submission notifications: Email —{' '}
      {labels[receipt.channels.email?.status] || 'Not recorded'}; Teams —{' '}
      {labels[receipt.channels.teams?.status] || 'Not recorded'}.
    </p>
  );
}
export default function ReviewNotifications() {
  const [rows, setRows] = useState<NotificationReceipt[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false);
  async function request(test = false) {
    setBusy(true);
    setError('');
    try {
      const response = await marketplaceStaffFetch(
        '/admin/notifications',
        test
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ test: true }),
            }
          : { cache: 'no-store' },
      );
      if (
        !response.ok ||
        !response.headers.get('Content-Type')?.includes('application/json')
      )
        throw Error(
          response.status === 401 || response.status === 403
            ? 'Sign in with your administrator account to check notifications.'
            : 'Notifications are unavailable. Refresh and try again.',
        );
      const data = await response.json();
      if (!Array.isArray(data.notifications))
        throw Error('Notification status is unavailable.');
      setRows(data.notifications);
      setLoaded(true);
    } catch (error) {
      setRows([]);
      setError(
        error instanceof Error
          ? error.message
          : 'Notifications are unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      busy ||
      !rows.some((row) =>
        Object.values(row.channels).some((d) =>
          ['queued', 'sending', 'claimed', 'retry'].includes(d.status),
        ),
      )
    )
      return;
    const timer = setTimeout(() => void request(), 5000);
    return () => clearTimeout(timer);
  }, [rows, busy]);
  return (
    <details className="admin-document-group admin-review-notifications">
      <summary>Listing notifications</summary>
      <p className="admin-muted">
        New submissions notify admin@rwas.team and Teams Shop Talk. Approval and
        change requests email the seller. Test messages are clearly labeled and
        do not create a listing.
      </p>
      <div className="admin-action-row">
        <button
          className="admin-button"
          type="button"
          disabled={busy}
          onClick={() => void request()}
        >
          Refresh delivery status
        </button>
        <button
          className="admin-button"
          type="button"
          disabled={busy}
          onClick={() => void request(true)}
        >
          Send test notification
        </button>
      </div>
      {error && (
        <p role="alert" className="admin-feedback">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="admin-muted">
          Checking notifications…
        </p>
      )}
      {loaded && !rows.length && (
        <p className="admin-muted">
          No listing notifications are recorded yet.
        </p>
      )}
      {rows.length > 0 && (
        <div
          className="admin-review-table-scroll"
          role="region"
          aria-label="Notification delivery status"
          tabIndex={0}
        >
          <table className="admin-review-table">
            <thead>
              <tr>
                <th scope="col">Notification</th>
                <th scope="col">Email</th>
                <th scope="col">Teams Shop Talk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.notificationId || row.listingId + ':' + row.revision}
                >
                  <td>
                    {row.kind === 'seller_decision'
                      ? 'Seller email: ' +
                        (row.decision === 'approved'
                          ? 'Approved'
                          : 'Changes requested') +
                        ' · Listing ' +
                        row.listingId.slice(0, 8)
                      : row.test
                        ? 'Delivery test'
                        : 'Listing ' + row.listingId.slice(0, 8)}
                    <br />
                    <time dateTime={new Date(row.submittedAt).toISOString()}>
                      {new Date(row.submittedAt).toLocaleString()}
                    </time>
                  </td>
                  {['email', 'teams'].map((channel) => (
                    <td key={channel}>
                      {row.kind === 'seller_decision' && channel === 'teams'
                        ? 'Not applicable'
                        : labels[row.channels[channel]?.status] ||
                          'Not recorded'}
                      {row.channels[channel]?.code && (
                        <>
                          <br />
                          <small>
                            {row.channels[channel].code} · Attempt{' '}
                            {row.channels[channel].attempts}
                          </small>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((row) =>
        Object.values(row.channels).some(
          (d) => d.code === 'delivery_uncertain',
        ),
      ) && (
        <p className="admin-feedback">
          A Teams delivery could not be confirmed. It has not been resent
          automatically to avoid duplicates; check Shop Talk.
        </p>
      )}
    </details>
  );
}
