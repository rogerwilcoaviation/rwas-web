'use client';
import { useState } from 'react';
import {
  AccountSection,
  AccountWorkspace,
} from '@/components/shared/AccountWorkspace';
import SellerAccounts from '../seller-accounts/SellerAccounts';
import SellerReview from '../seller-review/SellerReview';
import { ListingDraftWorkflow } from './listing-draft-workflow';
import { draftFields, getDraftFields } from './listing-draft-fields';
import {
  listingFormValues,
  listingPayload,
  listingTitle,
} from '@/lib/marketplace/schema.mjs';
import SupportDesk from './support-desk';
import AdministratorManagement from './administrator-management';
import {
  AdminListingStyles,
  ListingFacts,
  ListingStatus,
  ListingThumbnail,
} from './admin-listing-presentation';
type ManagedListing = {
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
export default function AdminWorkspace({
  request,
  canManageAdministrators = false,
}: {
  request: Request;
  canManageAdministrators?: boolean;
}) {
  const [section, setSection] = useState('review');
  return (
    <AccountWorkspace
      label="Administrator index"
      value={section}
      onValueChange={setSection}
      items={[
        { value: 'review', label: 'Approve listings' },
        { value: 'listings', label: 'Edit and delete listings' },
        { value: 'users', label: 'User accounts' },
        { value: 'support', label: 'Customer support' },
        ...(canManageAdministrators
          ? [{ value: 'administrators', label: 'Administrators' }]
          : []),
      ]}
    >
      <AccountSection value="review">
        <SellerReview embedded />
      </AccountSection>
      <AccountSection value="listings">
        <AdminListings request={request} />
      </AccountSection>
      <AccountSection value="users">
        <SellerAccounts allowIdentityAdministration={canManageAdministrators} />
      </AccountSection>
      <AccountSection value="support">
        <SupportDesk request={request} admin />
      </AccountSection>
      {canManageAdministrators && (
        <AccountSection value="administrators">
          <AdministratorManagement request={request} />
        </AccountSection>
      )}
    </AccountWorkspace>
  );
}
function AdminListings({ request }: { request: Request }) {
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
    setItems(
      ((await request('/admin/listings')) as { listings: ManagedListing[] })
        .listings,
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
      <header className="admin-panel-heading">
        <div>
          <h3>Edit and delete listings</h3>
          <p>
            Find a listing to update its details or move it to trash. Saved
            edits require approval before they appear publicly.
          </p>
        </div>
        <button
          className="admin-button"
          disabled={busy}
          onClick={() => void run(load)}
        >
          Load all listings
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
            busy={busy}
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
                  <ListingThumbnail photo={item.photos?.[0]} />
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
                          disabled={busy}
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
                          disabled={busy}
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
                          Delete listing
                        </button>
                      ) : (
                        <button
                          className="admin-button"
                          disabled={busy}
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
                    </div>
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
