'use client';
import { useEffect, useRef, useState } from 'react';
import { marketplaceStaffRequest } from '@/lib/marketplace-staff-fetch';
import { AdminListingStyles } from '../aircraft-for-sale/admin-listing-presentation';
type Target = { accountId: string } | { identityId: string };
type Plan = {
  target: Target;
  email: string;
  ready: boolean;
  blockers: string[];
  identityCount: number;
  listingCount: number;
  supportCount: number;
  confirmation: string;
  operationId: string;
  reasonCode: string;
  resuming?: boolean;
  includeListings?: boolean;
};
export default function PermanentAccountRemoval({
  target,
  canManage,
  onComplete,
}: {
  target: Target;
  canManage: boolean;
  onComplete: () => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null),
    [typed, setTyped] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [includeListings, setIncludeListings] = useState(false),
    [reason, setReason] = useState('support-request');
  const generation = useRef(0);
  useEffect(() => {
    const ref = generation;
    return () => {
      ref.current++;
    };
  }, []);
  const run = async (action: (g: number) => Promise<void>) => {
    const g = ++generation.current;
    setBusy(true);
    setError('');
    try {
      await action(g);
    } catch (e) {
      if (g === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Deletion could not be confirmed. Retry the same deletion.',
        );
    } finally {
      if (g === generation.current) setBusy(false);
    }
  };
  return (
    <section
      className="admin-listing-panel removal-panel"
      aria-label="Permanent account deletion"
    >
      <AdminListingStyles />
      <h3>Permanently delete user account</h3>
      <p>
        Remove the account, linked RWAS sign-in credentials, saved draft and
        support conversations. Move the account to trash first. You can include
        all of its listings and their photos, videos and documents in this
        deletion. This cannot be undone. A minimal administrator audit record is
        retained.
      </p>
      {!plan ? (
        <>
          <label className="removal-option">
            <input
              type="checkbox"
              checked={includeListings}
              disabled={busy || !canManage}
              onChange={(e) => setIncludeListings(e.target.checked)}
            />
            <span>
              Also permanently delete all of this user’s listings and files
            </span>
          </label>
          <label>
            Deletion reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy || !canManage}
            >
              <option value="support-request">Customer support request</option>
              <option value="abuse-prevention">Abuse prevention</option>
              <option value="maintenance">Maintenance</option>
              <option value="account-recovery">Account recovery</option>
            </select>
          </label>
          <button
            className="admin-button admin-danger"
            disabled={busy || !canManage}
            onClick={() =>
              void run(async (g) => {
                const result = await marketplaceStaffRequest(
                  '/admin/removals/preview',
                  'POST',
                  { target, reasonCode: reason, includeListings },
                );
                if (g === generation.current) {
                  setPlan(result);
                  setTyped('');
                }
              })
            }
          >
            Review permanent account deletion
          </button>
        </>
      ) : (
        <div
          className="removal-confirm"
          role="region"
          aria-label="Confirm permanent account deletion"
        >
          <h4>Review deletion of {plan.email}</h4>
          {!plan.ready ? (
            <>
              <ul>
                {plan.blockers.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <button
                className="admin-button"
                disabled={busy}
                onClick={() => setPlan(null)}
              >
                Back to account cleanup
              </button>
            </>
          ) : (
            <>
              <p>
                {plan.identityCount} linked sign-in account(s) and{' '}
                {plan.supportCount} support conversation(s) will be permanently
                removed.
              </p>
              {plan.includeListings && (
                <p role="note">
                  All {plan.listingCount} listing(s) owned by this user,
                  including their photos, videos and documents, will also be
                  permanently deleted. Other users’ listings will remain
                  unchanged.
                </p>
              )}
              {plan.resuming && (
                <p>
                  Cleanup previously started. Confirm the email again to resume
                  the same deletion.
                </p>
              )}
              <label>
                Type account email to permanently delete
                <input
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={busy || !canManage}
                />
              </label>
              <div className="admin-action-row">
                <button
                  className="admin-button admin-danger"
                  disabled={busy || !canManage || typed !== plan.email}
                  onClick={() =>
                    void run(async (g) => {
                      await marketplaceStaffRequest(
                        '/admin/removals/apply',
                        'POST',
                        {
                          target: plan.target,
                          reasonCode: plan.reasonCode,
                          operationId: plan.operationId,
                          confirmation: plan.confirmation,
                          confirmEmail: typed,
                          includeListings: plan.includeListings === true,
                        },
                      );
                      if (g === generation.current) {
                        setPlan(null);
                        setTyped('');
                        onComplete();
                      }
                    })
                  }
                >
                  Confirm permanent account deletion
                </button>
                <button
                  className="admin-button"
                  disabled={busy}
                  onClick={() => {
                    setPlan(null);
                    setTyped('');
                  }}
                >
                  Cancel permanent deletion
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="admin-feedback" role="alert">
          {error}
        </p>
      )}
      <style jsx>{`
        .removal-panel {
          margin-top: 24px;
          padding: 20px;
          border: 1px solid #d8b8b0;
          background: #fffaf8;
          min-width: 0;
        }
        .removal-panel h3 {
          margin: 0 0 12px;
          font:
            600 20px/1.4 Arial,
            sans-serif;
        }
        .removal-panel p,
        .removal-panel li {
          font:
            15px/1.6 Arial,
            sans-serif;
        }
        .removal-panel label {
          display: grid;
          gap: 8px;
          margin: 16px 0;
          font:
            600 14px/1.5 Arial,
            sans-serif;
        }
        .removal-panel input,
        .removal-panel select {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid #8e877b;
          background: white;
          color: #25251f;
          font:
            15px/1.5 Arial,
            sans-serif;
        }
        .removal-panel input:focus-visible,
        .removal-panel select:focus-visible {
          outline: 3px solid #8b6c0a;
          outline-offset: 3px;
        }
        .removal-panel .removal-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .removal-panel .removal-option input {
          width: 20px;
          height: 20px;
          margin-top: 2px;
          flex-shrink: 0;
        }
      `}</style>
    </section>
  );
}

export function PendingAccountRemovals({
  canManage,
  onComplete,
}: {
  canManage: boolean;
  onComplete: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const ref = generation;
    return () => {
      ref.current++;
    };
  }, []);
  async function load() {
    const g = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const result = await marketplaceStaffRequest('/admin/removals');
      if (g === generation.current) {
        setPlans(result.removals);
        setLoaded(true);
      }
    } catch (e) {
      if (g === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Unfinished deletions could not be loaded.',
        );
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  return (
    <section
      className="admin-listing-panel"
      aria-label="Unfinished account deletions"
    >
      <AdminListingStyles />
      <h3>Unfinished deletions</h3>
      <p>
        If deletion was interrupted, load the saved operation and confirm the
        email again to resume cleanup. The super administrator can also finish
        another administrator’s operation.
      </p>
      <button
        className="admin-button"
        disabled={busy}
        onClick={() => void load()}
      >
        Load unfinished deletions
      </button>
      {error && (
        <p className="admin-feedback" role="alert">
          {error}
        </p>
      )}
      {loaded && !plans.length && (
        <p className="admin-empty">No unfinished account deletions.</p>
      )}
      {plans.map((plan) => (
        <PermanentAccountRemoval
          key={plan.operationId}
          target={plan.target}
          canManage={canManage && !busy}
          onComplete={() => {
            void load();
            onComplete();
          }}
        />
      ))}
    </section>
  );
}
