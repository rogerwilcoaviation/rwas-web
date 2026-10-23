'use client';
import { useState } from 'react';
import { ListingDraftWorkflow } from './listing-draft-workflow';
import { draftFields, getDraftFields } from './listing-draft-fields';
import {
  listingFormValues,
  listingPayload,
  listingTitle,
} from '@/lib/marketplace/schema.mjs';
import {
  AdminListingStyles,
  ListingFacts,
  ListingStatus,
  ListingThumbnail,
} from './admin-listing-presentation';
type ManagedListing = {
  ownerId: string;
  id: string;
  status: string;
  revision: number;
  fields: Record<string, unknown>;
  photos: { key: string; name?: string }[];
  videos: { key: string }[];
  logbooks: Record<string, { key: string }[]>;
};
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
export default function AdminListings({
  request,
  ownerId,
  canManage = true,
  onChanged,
}: {
  request: Request;
  ownerId?: string;
  canManage?: boolean;
  onChanged?: () => void;
}) {
  const [purgeTarget, setPurgeTarget] = useState<{
      id: string;
      revision: number;
    } | null>(null),
    [purgeConfirm, setPurgeConfirm] = useState('');
  const [items, setItems] = useState<ManagedListing[]>([]),
    [editing, setEditing] = useState<ManagedListing | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loaded, setLoaded] = useState(false),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('all');
  async function load() {
    const data = (await request('/admin/listings')) as {
      listings: ManagedListing[];
    };
    setItems(
      data.listings.filter((item) => !ownerId || item.ownerId === ownerId),
    );
    setLoaded(true);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The operation failed. Reload before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(submit = false) {
    if (!editing) throw Error('Select a listing first.');
    const visible = new Set(getDraftFields(values).map((f) => f.name));
    const fields = listingPayload(
      Object.fromEntries(
        Object.entries(values).filter(
          ([k]) => visible.has(k) || k === 'workflowVersion',
        ),
      ),
    );
    const result = (await request('/admin/listings/' + editing.id, 'PUT', {
      revision: editing.revision,
      fields,
      submitForReview: submit,
    })) as { listing: ManagedListing };
    setEditing(result.listing);
    await load();
    setNotice(
      submit
        ? 'Listing returned to the approval queue.'
        : 'Changes saved privately. Review is required before publication.',
    );
  }
  const filtered = items.filter(
    (item) =>
      (status === 'all' || item.status === status) &&
      [
        listingTitle(item.fields || item),
        item.id,
        item.fields?.sellerName,
        item.fields?.sellerLocation,
        item.fields?.nNumber,
        item.fields?.partNumber,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
  );
  return (
    <section
      className="admin-listing-panel"
      aria-label="Manage marketplace listings"
    >
      <AdminListingStyles />
      <style jsx>{`
        .admin-purge-confirm {
          margin-top: 20px;
          padding: 18px;
          border: 1px solid #d8b8b0;
          background: #fffaf8;
        }
        .admin-purge-confirm label {
          display: grid;
          gap: 8px;
          margin: 16px 0;
        }
        .admin-purge-confirm input {
          box-sizing: border-box;
          width: 100%;
          padding: 12px;
          border: 1px solid #8e877b;
          font:
            15px Arial,
            sans-serif;
        }
        .admin-purge-confirm input:focus-visible {
          outline: 3px solid #8b6c0a;
          outline-offset: 3px;
        }
      `}</style>
      <header className="admin-panel-heading">
        <div>
          <h3>Edit and delete listings</h3>
          <p>
            Edit a listing, move it to trash or permanently delete a trashed
            listing and its photos, videos and documents. Permanent deletion
            cannot be undone.
          </p>
        </div>
        <button
          className="admin-button"
          disabled={busy}
          onClick={() => void run(load)}
        >
          {ownerId ? 'Load user listings' : 'Load all listings'}
        </button>
      </header>
      {error && (
        <p className="admin-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-feedback" role="status">
          {notice}
        </p>
      )}
      {editing ? (
        <>
          <div className="admin-editor-heading">
            <div className="admin-action-row">
              <ListingStatus status={editing.status} />
              <span className="admin-muted">Revision {editing.revision}</span>
            </div>
            <h4>{listingTitle(editing.fields || editing)}</h4>
            <div>
              <button
                className="admin-button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setNotice('');
                }}
              >
                Back to all listings
              </button>
            </div>
          </div>
          <ListingDraftWorkflow
            key={editing.id}
            values={values}
            onChange={(name, value) =>
              setValues((old) => {
                const next = { ...old, [name]: value };
                if (['listingType', 'category'].includes(name)) {
                  for (const key of Object.keys(next))
                    if (key.startsWith('spec:')) delete next[key];
                  if (name === 'listingType') next.category = '';
                }
                return next;
              })
            }
            busy={busy || !canManage}
            saved
            onSave={async () => {
              let ok = false;
              await run(async () => {
                await save();
                ok = true;
              });
              return ok;
            }}
            onSubmitReview={() =>
              run(async () => {
                await save(true);
                setEditing(null);
              })
            }
            mediaCounts={Object.fromEntries(
              [
                'photos',
                'videos',
                'airframe',
                'powerplant',
                'propeller',
                'adSbCompliance',
                'misc',
              ].map((k) => [
                k,
                k === 'photos' || k === 'videos'
                  ? editing[k]?.length || 0
                  : editing.logbooks?.[k]?.length || 0,
              ]),
            )}
            renderMedia={(category) => (
              <p>
                Existing {category} attachments are available in the listing
                approval panel.
              </p>
            )}
          />
        </>
      ) : (
        <>
          {loaded ? (
            <>
              <div className="admin-listing-toolbar">
                <label>
                  Search listings
                  <input
                    type="search"
                    placeholder="Title, seller, registration or part number"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label>
                  Listing status
                  <select
                    aria-label="Listing status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {Array.from(new Set(items.map((item) => item.status)))
                      .sort()
                      .map((value) => (
                        <option key={value} value={value}>
                          {(
                            {
                              pending: 'Awaiting review',
                              deleted: 'In trash',
                              rejected: 'Changes requested',
                            } as Record<string, string>
                          )[value] ||
                            value.charAt(0).toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <p className="admin-muted" role="status">
                Showing {filtered.length} of {items.length} listings
              </p>
            </>
          ) : (
            <p className="admin-empty">
              Load all listings to choose one to edit, remove or restore.
            </p>
          )}
          {loaded && !filtered.length && (
            <p className="admin-empty">
              {items.length
                ? 'No listings match your search.'
                : 'No listings are available.'}
            </p>
          )}
          <div className="admin-listing-list">
            {filtered.map((item) => (
              <article
                className="admin-listing-card"
                key={item.id}
                aria-label={listingTitle(item.fields || item)}
              >
                <div className="admin-listing-row">
                  <ListingThumbnail
                    photo={
                      item.status === 'deleted' ? undefined : item.photos?.[0]
                    }
                  />
                  <div>
                    <header className="admin-card-heading">
                      <div>
                        <h4 className="admin-card-title">
                          {listingTitle(item.fields || item)}
                        </h4>
                        <p className="admin-card-revision">
                          Revision {item.revision}
                          {item.fields?.sellerName
                            ? ' · Seller: ' + String(item.fields.sellerName)
                            : ''}
                        </p>
                      </div>
                      <ListingStatus status={item.status} />
                    </header>
                    <ListingFacts fields={item.fields || item} />
                    <div className="admin-management-actions">
                      {!['deleted', 'archived'].includes(item.status) && (
                        <button
                          className="admin-button admin-primary"
                          disabled={busy || !canManage}
                          onClick={() => {
                            setEditing(item);
                            setValues(
                              listingFormValues(
                                item.fields || item,
                                draftFields,
                              ),
                            );
                            setNotice('');
                          }}
                        >
                          Edit listing
                        </button>
                      )}
                      {item.status !== 'deleted' ? (
                        <button
                          className="admin-button admin-danger"
                          disabled={busy || !canManage}
                          onClick={() => {
                            if (
                              confirm(
                                'Move this listing to trash and remove it from public view?',
                              )
                            )
                              void run(async () => {
                                await request(
                                  '/admin/listings/' + item.id,
                                  'DELETE',
                                  {
                                    revision: item.revision,
                                    confirm: item.id,
                                  },
                                );
                                await load();
                              });
                          }}
                        >
                          Move listing to trash
                        </button>
                      ) : (
                        <button
                          className="admin-button"
                          disabled={busy || !canManage}
                          onClick={() =>
                            void run(async () => {
                              await request(
                                '/admin/listings/' + item.id,
                                'POST',
                                {
                                  revision: item.revision,
                                  action: 'restore',
                                },
                              );
                              await load();
                            })
                          }
                        >
                          Restore to draft
                        </button>
                      )}
                      {item.status === 'deleted' && (
                        <button
                          className="admin-button admin-danger"
                          disabled={busy || !canManage}
                          onClick={() => {
                            setPurgeTarget({
                              id: item.id,
                              revision: item.revision,
                            });
                            setPurgeConfirm('');
                            setNotice('');
                          }}
                        >
                          Permanently delete listing
                        </button>
                      )}
                    </div>
                    {purgeTarget?.id === item.id &&
                      purgeTarget.revision === item.revision && (
                        <section
                          className="admin-purge-confirm"
                          aria-label="Confirm permanent listing deletion"
                        >
                          <h4>Permanently delete this listing?</h4>
                          <p>
                            This removes the listing and all its photos, videos
                            and documents. It cannot be restored.
                          </p>
                          <p>
                            Listing ID: <code>{item.id}</code>
                          </p>
                          <label>
                            Type listing ID to permanently delete
                            <input
                              value={purgeConfirm}
                              autoComplete="off"
                              onChange={(event) =>
                                setPurgeConfirm(event.target.value)
                              }
                              disabled={busy || !canManage}
                            />
                          </label>
                          <div className="admin-action-row">
                            <button
                              className="admin-button admin-danger"
                              disabled={
                                busy || !canManage || purgeConfirm !== item.id
                              }
                              onClick={() =>
                                void run(async () => {
                                  await request(
                                    '/admin/listings/' + item.id,
                                    'POST',
                                    {
                                      revision: item.revision,
                                      action: 'purge',
                                      confirm: purgeConfirm,
                                    },
                                  );
                                  setPurgeTarget(null);
                                  setPurgeConfirm('');
                                  await load();
                                  onChanged?.();
                                  setNotice(
                                    'Listing and its files permanently deleted.',
                                  );
                                })
                              }
                            >
                              Confirm permanent listing deletion
                            </button>
                            <button
                              className="admin-button"
                              disabled={busy}
                              onClick={() => {
                                setPurgeTarget(null);
                                setPurgeConfirm('');
                              }}
                            >
                              Cancel permanent deletion
                            </button>
                          </div>
                        </section>
                      )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
