/* eslint-disable @next/next/no-img-element -- Private listing media is served through authenticated staff routes. */
'use client';
import {
  categoryFor,
  listingFormValues,
  listingPrice,
  listingTypes,
} from '@/lib/marketplace/schema.mjs';
import { draftFields, getDraftFields } from './listing-draft-fields';
import { marketplaceStaffMediaPath } from '@/lib/marketplace-staff-fetch';

export const fieldLabel = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
export function ListingStatus({ status }: { status: string }) {
  const label: Record<string, string> = {
    pending: 'Awaiting review',
    approved: 'Approved',
    published: 'Published',
    draft: 'Draft',
    rejected: 'Changes requested',
    deleted: 'In trash',
    archived: 'Archived',
  };
  return (
    <span className="admin-listing-status" data-status={status}>
      {label[status] || fieldLabel(status)}
    </span>
  );
}
export function ListingFacts({ fields }: { fields: Record<string, unknown> }) {
  const category =
    categoryFor(fields)?.label ||
    listingTypes.find(
      ([value]: string[]) => value === fields.listingType,
    )?.[1] ||
    'Aircraft';
  return (
    <dl className="admin-listing-facts">
      <div>
        <dt>Category</dt>
        <dd>{category}</dd>
      </div>
      <div>
        <dt>Asking price</dt>
        <dd>{listingPrice(fields)}</dd>
      </div>
      <div>
        <dt>Location</dt>
        <dd>
          {String(fields.sellerLocation || fields.airport || 'Not provided')}
        </dd>
      </div>
    </dl>
  );
}
function displayValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (typeof value === 'object' && value !== null)
    return Object.entries(value)
      .map(([key, item]) => fieldLabel(key) + ': ' + displayValue(item))
      .join('\n');
  return String(value);
}
export function ListingDetails({
  fields,
  headingLevel = 3,
}: {
  fields: Record<string, unknown>;
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const definitions = getDraftFields(listingFormValues(fields, draftFields));
  const groups = new Map<
    string,
    { key: string; label: string; value: string; long: boolean }[]
  >();
  const flat = Object.entries(fields).flatMap(([key, value]) =>
    key === 'specifications' && value && typeof value === 'object'
      ? Object.entries(value).map(
          ([name, item]) => ['spec:' + name, item] as const,
        )
      : [[key, value] as const],
  );
  for (const [key, value] of flat) {
    if (
      ['workflowVersion', 'title', 'specifications'].includes(key) ||
      value === '' ||
      value === null ||
      value === undefined
    )
      continue;
    const definition = definitions.find((field) => field.name === key);
    const long =
      ['description', 'avionics', 'equipmentList', 'damageHistory'].includes(
        key,
      ) || !!definition?.multiline;
    const group = key.startsWith('seller')
      ? 'Seller and location'
      : key.startsWith('spec:')
        ? definition?.group || 'Specifications'
        : long
          ? 'Description and condition'
          : 'Listing details';
    let formatted =
      key === 'price' ? listingPrice(fields) : displayValue(value);
    if (key === 'category') formatted = categoryFor(fields)?.label || formatted;
    if (key === 'listingType')
      formatted =
        listingTypes.find(([id]: string[]) => id === value)?.[1] || formatted;
    const option = definition?.options?.find(
      (option) => typeof option !== 'string' && option.value === value,
    );
    if (option && typeof option !== 'string') formatted = option.label;
    const rows = groups.get(group) || [];
    rows.push({
      key,
      label:
        (
          {
            listingType: 'Listing type',
            category: 'Category',
            price: 'Asking price',
            priceMode: 'Price display',
            transactionType: 'Sale or lease',
          } as Record<string, string>
        )[key] ||
        definition?.label ||
        fieldLabel(key.replace(/^spec:/, '')),
      value: formatted,
      long,
    });
    groups.set(group, rows);
  }
  return (
    <div className="admin-listing-details">
      {Array.from(groups, ([group, rows]) => (
        <div className="admin-listing-detail-group" key={group}>
          <Heading>{group}</Heading>
          <dl>
            {rows.map((row) => (
              <div
                className={row.long ? 'admin-detail-wide' : ''}
                key={row.key}
              >
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
export function ListingThumbnail({
  photo,
}: {
  photo?: { key: string; name?: string };
}) {
  return photo ? (
    <img
      className="admin-listing-thumbnail"
      src={marketplaceStaffMediaPath(photo.key)}
      alt={photo.name || 'Listing photo'}
      loading="lazy"
    />
  ) : (
    <div className="admin-listing-thumbnail admin-listing-no-photo">
      No preview
    </div>
  );
}
export function AdminListingStyles() {
  return (
    <style jsx global>{`
      .admin-listing-panel {
        min-width: 0;
        color: #25251f;
        font-family: Arial, sans-serif;
        font-size: 15px;
        line-height: 1.55;
        overflow-wrap: anywhere;
      }
      .admin-listing-panel.admin-review-standalone {
        max-width: 1100px;
        padding: 24px;
        margin: 32px auto;
        box-sizing: border-box;
      }
      .admin-listing-panel .admin-panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 22px;
      }
      .admin-listing-panel .admin-panel-heading h1,
      .admin-listing-panel .admin-panel-heading h2,
      .admin-listing-panel .admin-panel-heading h3 {
        font:
          600 24px/1.25 Arial,
          sans-serif;
        margin: 0 0 8px;
      }
      .admin-listing-panel .admin-panel-heading p {
        margin: 0;
        max-width: 66ch;
        color: #625e55;
      }
      .admin-listing-panel .admin-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        box-sizing: border-box;
        padding: 10px 16px;
        margin: 0;
        border: 1px solid #514d43;
        border-radius: 4px;
        background: #fff;
        color: #292820;
        font:
          600 14px/1.4 Arial,
          sans-serif;
        cursor: pointer;
        text-decoration: none;
        text-align: center;
        flex-shrink: 0;
      }
      .admin-listing-panel .admin-button:hover:not(:disabled) {
        background: #f4f0e6;
      }
      .admin-listing-panel .admin-button.admin-primary {
        background: #b99727;
        color: #19180f;
        border-color: #94771a;
      }
      .admin-listing-panel .admin-button.admin-primary:hover:not(:disabled) {
        background: #c9a737;
      }
      .admin-listing-panel .admin-button.admin-danger {
        color: #943b31;
        border-color: #ba7168;
      }
      .admin-listing-panel .admin-button.admin-danger:hover:not(:disabled) {
        background: #fff0ed;
      }
      .admin-listing-panel .admin-button:disabled {
        opacity: 0.48;
        cursor: not-allowed;
      }
      .admin-listing-panel .admin-button:focus-visible,
      .admin-listing-panel input:focus-visible,
      .admin-listing-panel select:focus-visible,
      .admin-listing-panel textarea:focus-visible,
      .admin-listing-panel a:focus-visible,
      .admin-listing-panel summary:focus-visible {
        outline: 3px solid #8b6c0a;
        outline-offset: 3px;
      }
      .admin-listing-panel .admin-listing-list {
        display: grid;
        gap: 20px;
      }
      .admin-listing-panel .admin-listing-card {
        min-width: 0;
        padding: 22px;
        border: 1px solid #d5cec1;
        border-radius: 6px;
        background: #fff;
      }
      .admin-listing-panel .admin-card-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .admin-listing-panel .admin-card-heading > div,
      .admin-listing-panel .admin-panel-heading > div {
        min-width: 0;
      }
      .admin-listing-panel .admin-card-heading .admin-card-title {
        font:
          600 21px/1.3 Arial,
          sans-serif;
        margin: 0 0 8px;
        color: #222;
      }
      .admin-listing-panel .admin-card-revision {
        margin: 0;
        color: #716b60;
        font-size: 13px;
      }
      .admin-listing-panel .admin-listing-status {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border: 1px solid #d2ccc0;
        border-radius: 4px;
        background: #f3f1eb;
        color: #514b40;
        font:
          600 12px/1.4 Arial,
          sans-serif;
        white-space: nowrap;
      }
      .admin-listing-panel .admin-listing-status[data-status='pending'] {
        background: #fbf2d9;
        border-color: #ddc783;
        color: #705218;
      }
      .admin-listing-panel .admin-listing-status[data-status='approved'],
      .admin-listing-panel .admin-listing-status[data-status='published'] {
        background: #eaf3e9;
        border-color: #b5cbb0;
        color: #365b32;
      }
      .admin-listing-panel .admin-listing-status[data-status='deleted'],
      .admin-listing-panel .admin-listing-status[data-status='rejected'] {
        background: #fbede9;
        border-color: #dfbdb4;
        color: #8a4535;
      }
      .admin-listing-panel .admin-listing-facts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin: 0;
        padding: 16px;
        background: #f7f5ef;
        border-radius: 4px;
      }
      .admin-listing-panel .admin-listing-facts > div,
      .admin-listing-panel .admin-listing-detail-group dl > div {
        display: block;
        min-width: 0;
        padding: 0;
        border: 0;
      }
      .admin-listing-panel .admin-listing-facts dt,
      .admin-listing-panel .admin-listing-detail-group dt {
        margin: 0 0 4px;
        color: #726b5e;
        font-size: 12px;
        font-weight: 600;
      }
      .admin-listing-panel .admin-listing-facts dd {
        margin: 0;
        font-weight: 600;
        font-size: 14px;
      }
      .admin-listing-panel .admin-listing-details {
        display: grid;
        gap: 24px;
        padding-top: 24px;
      }
      .admin-listing-panel .admin-listing-detail-group h3,
      .admin-listing-panel .admin-listing-detail-group h4 {
        font:
          600 16px/1.4 Arial,
          sans-serif;
        margin: 0 0 12px;
        padding-bottom: 9px;
        border-bottom: 1px solid #e4dfd4;
      }
      .admin-listing-panel .admin-listing-detail-group dl {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px 24px;
        margin: 0;
      }
      .admin-listing-panel .admin-listing-detail-group dd {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.6;
      }
      .admin-listing-panel .admin-detail-wide {
        grid-column: 1 / -1;
      }
      .admin-listing-panel .admin-review-media {
        margin-top: 24px;
      }
      .admin-listing-panel .admin-review-media h3,
      .admin-listing-panel .admin-documents h3,
      .admin-listing-panel .admin-review-media h4,
      .admin-listing-panel .admin-documents h4 {
        font:
          600 16px/1.4 Arial,
          sans-serif;
        margin: 0 0 12px;
      }
      .admin-listing-panel .admin-photo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
        gap: 12px;
      }
      .admin-listing-panel .admin-photo-grid a {
        display: block;
        color: inherit;
        min-width: 0;
        border: 1px solid #ddd7ca;
        border-radius: 4px;
        overflow: hidden;
        background: #f4f1e9;
      }
      .admin-listing-panel .admin-photo-grid img,
      .admin-listing-panel .admin-photo-grid video {
        display: block;
        width: 100%;
        height: 170px;
        object-fit: contain;
        background: #eeebe3;
      }
      .admin-listing-panel .admin-photo-caption {
        display: block;
        padding: 8px 10px;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .admin-listing-panel .admin-documents {
        margin-top: 24px;
      }
      .admin-listing-panel .admin-document-group {
        padding: 12px 14px;
        border: 1px solid #e0d9cc;
        border-radius: 4px;
        margin: 10px 0;
      }
      .admin-listing-panel .admin-document-group summary {
        font-weight: 600;
        cursor: pointer;
      }
      .admin-listing-panel .admin-document-group a {
        color: #6b5112;
        text-decoration: underline;
      }
      .admin-listing-panel .admin-review-footer {
        display: grid;
        gap: 14px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid #d5cec1;
      }
      .admin-listing-panel .admin-review-note {
        display: grid;
        gap: 8px;
        font-weight: 600;
      }
      .admin-listing-panel .admin-review-note textarea {
        width: 100%;
        min-height: 92px;
        box-sizing: border-box;
        padding: 12px;
        border: 1px solid #a7a093;
        border-radius: 4px;
        font:
          400 15px/1.5 Arial,
          sans-serif;
        resize: vertical;
      }
      .admin-listing-panel .admin-action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .admin-listing-panel .admin-listing-row {
        display: grid;
        grid-template-columns: 124px minmax(0, 1fr);
        gap: 20px;
      }
      .admin-listing-panel .admin-listing-thumbnail {
        display: block;
        width: 124px;
        height: 100px;
        object-fit: contain;
        border: 1px solid #ded8cd;
        border-radius: 4px;
        background: #f3f0e8;
        box-sizing: border-box;
      }
      .admin-listing-panel .admin-listing-no-photo {
        display: grid;
        place-items: center;
        color: #736c5d;
        font-size: 13px;
      }
      .admin-listing-panel .admin-listing-card .admin-management-actions {
        margin-top: 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .admin-listing-panel .admin-management-actions .admin-danger {
        margin-left: auto;
      }
      .admin-listing-panel .admin-listing-toolbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 180px;
        gap: 14px;
        padding: 16px;
        background: #f7f5ef;
        border: 1px solid #e3ddd1;
        border-radius: 4px;
        margin: 0 0 16px;
      }
      .admin-listing-panel .admin-listing-toolbar label {
        margin: 0;
        display: grid;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
      }
      .admin-listing-panel .admin-listing-toolbar input,
      .admin-listing-panel .admin-listing-toolbar select {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        border: 1px solid #aaa294;
        border-radius: 3px;
        padding: 10px;
        background: #fff;
        color: #292820;
        box-sizing: border-box;
        font:
          400 14px Arial,
          sans-serif;
      }
      .admin-listing-panel .admin-feedback {
        margin: 16px 0;
        padding: 12px 14px;
        border-left: 3px solid #b99727;
        background: #f8f5eb;
      }
      .admin-listing-panel .admin-feedback[role='alert'] {
        border-left-color: #a64536;
        background: #fcf0ed;
      }
      .admin-listing-panel .admin-empty {
        padding: 28px 20px;
        background: #faf8f3;
        border: 1px dashed #cec4b2;
        color: #6d665a;
        text-align: center;
      }
      .admin-listing-panel .admin-muted {
        margin: 14px 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: #736c5f;
        font-size: 13px;
      }
      .admin-listing-panel .admin-editor-heading {
        display: grid;
        gap: 14px;
        padding: 18px;
        margin-bottom: 22px;
        background: #f7f5ef;
        border: 1px solid #ded6c7;
        border-radius: 4px;
      }
      .admin-listing-panel .admin-editor-heading h4 {
        margin: 0;
        font:
          600 20px/1.35 Arial,
          sans-serif;
      }
      @media (max-width: 760px) {
        .admin-listing-panel .admin-panel-heading {
          flex-direction: column;
          gap: 14px;
        }
        .admin-listing-panel .admin-listing-card {
          padding: 16px;
        }
        .admin-listing-panel .admin-listing-row {
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        .admin-listing-panel .admin-listing-thumbnail {
          width: 100%;
          height: 160px;
        }
        .admin-listing-panel .admin-card-heading {
          flex-direction: column-reverse;
          gap: 10px;
        }
        .admin-listing-panel .admin-listing-facts,
        .admin-listing-panel .admin-listing-toolbar,
        .admin-listing-panel .admin-listing-detail-group dl {
          grid-template-columns: minmax(0, 1fr);
        }
        .admin-listing-panel .admin-listing-facts {
          gap: 12px;
        }
        .admin-listing-panel .admin-listing-facts > div {
          display: grid;
          grid-template-columns: 95px minmax(0, 1fr);
          gap: 10px;
        }
        .admin-listing-panel .admin-action-row .admin-button,
        .admin-listing-panel .admin-management-actions .admin-button {
          flex: 1 1 100%;
          margin-left: 0;
        }
      }
    `}</style>
  );
}
