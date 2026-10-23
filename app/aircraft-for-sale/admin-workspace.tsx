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
type ManagedListing = {
  id: string;
  status: string;
  revision: number;
  fields: Record<string, unknown>;
  photos: { key: string }[];
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
        <SellerReview />
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
    [notice, setNotice] = useState('');
  async function load() {
    setItems(
      ((await request('/admin/listings')) as { listings: ManagedListing[] })
        .listings,
    );
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
  return (
    <section aria-label="Manage marketplace listings">
      <h3>Edit and delete listings</h3>
      <p>
        Edits remove approval and save privately. Deletion moves a listing to
        trash and preserves its files for recovery.
      </p>
      <button disabled={busy} onClick={() => void run(load)}>
        Load all listings
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {editing ? (
        <>
          <button
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setNotice('');
            }}
          >
            Back to all listings
          </button>
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
        items.map((item) => (
          <article key={item.id}>
            <h4>{listingTitle(item.fields || item)}</h4>
            <p>
              {item.status} · Revision {item.revision}
            </p>
            {!['deleted', 'archived'].includes(item.status) && (
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(item);
                  setValues(
                    listingFormValues(item.fields || item, draftFields),
                  );
                  setNotice('');
                }}
              >
                Edit listing
              </button>
            )}
            {item.status !== 'deleted' ? (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      'Move this listing to trash and remove it from public view?',
                    )
                  )
                    void run(async () => {
                      await request('/admin/listings/' + item.id, 'DELETE', {
                        revision: item.revision,
                        confirm: item.id,
                      });
                      await load();
                    });
                }}
              >
                Delete listing
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await request('/admin/listings/' + item.id, 'POST', {
                      revision: item.revision,
                      action: 'restore',
                    });
                    await load();
                  })
                }
              >
                Restore to draft
              </button>
            )}
          </article>
        ))
      )}
      <style jsx>{`
        section {
          font-family: Arial, sans-serif;
        }
        article {
          padding: 16px 0;
          border-top: 1px solid #aaa;
        }
        button {
          padding: 10px 14px;
          margin: 6px;
        }
        h4 {
          font-size: 18px;
        }
      `}</style>
    </section>
  );
}
