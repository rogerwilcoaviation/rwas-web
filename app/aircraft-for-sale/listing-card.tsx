/* eslint-disable @next/next/no-img-element */
// ============================================================================
// Fix #4 companion — ListingCard (client component)
// Target: ~/projects/rwas-web/app/aircraft-for-sale/listing-card.tsx  (NEW)
// ============================================================================
//
// Renders a single listing tile in the inventory grid. Handles photo lazy
// loading and a graceful fallback when /files/{key} 404s or no photo exists.
//
// Styling matches the newspaper aesthetic used elsewhere on the site — plain
// inline CSS, serif headings, subdued earth tones. No Tailwind, no
// next/image (sale-api host is external and not whitelisted in
// next.config.js; plain <img loading="lazy"> is fine here).
// ============================================================================

"use client";

import { useState } from "react";

export interface Listing {
  id: string;
  make?: string;
  model?: string;
  year?: string;
  nNumber?: string;
  price?: string | number;
  sellerLocation?: string;
  totalTime?: string | number;
  engineTime?: string | number;
  status?: string;
  photos?: Array<{ key: string; name?: string; contentType?: string }>;
}

function formatPrice(price: Listing["price"]): string {
  if (price === undefined || price === null || price === "") {
    return "Price on request";
  }
  const n =
    typeof price === "number" ? price : Number(String(price).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "Price on request";
  return `$${n.toLocaleString()}`;
}

function formatHours(v: Listing["totalTime"]): string | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toLocaleString()} hrs`;
}

export function ListingCard({ listing }: { listing: Listing }) {
  const [imageBroken, setImageBroken] = useState(false);
  const isSold = listing.status === "sold";

  const firstPhoto = listing.photos?.[0];
  const photoBase =
    firstPhoto && firstPhoto.key
      ? `https://sale-api.rogerwilcoaviation.com/files/${encodeURIComponent(
          firstPhoto.key,
        )}`
      : null;
  // Resized variants via Worker: w=800 for default, w=1200 for retina.
  // Aircraft cards display ~280-400px wide on mobile, ~360px on desktop.
  const imageUrl = photoBase ? `${photoBase}?w=800&q=80` : null;
  const imageSrcSet = photoBase
    ? `${photoBase}?w=600&q=80 600w, ${photoBase}?w=800&q=80 800w, ${photoBase}?w=1200&q=80 1200w`
    : undefined;

  const headline =
    [listing.year, listing.make, listing.model].filter(Boolean).join(" ") ||
    "Aircraft listing";
  const priceLabel = formatPrice(listing.price);
  const tt = formatHours(listing.totalTime);
  const et = formatHours(listing.engineTime);

  return (
    <>
      <style>{`
        .a4s-card {
          position: relative;
          display: block;
          text-decoration: none;
          color: #1a1a1a;
          border: 1px solid #1a1a1a;
          background: rgba(245, 243, 239, 0.92);
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .a4s-card--sold {
          border: 4px solid #8b0000;
          background: rgba(250, 244, 231, 0.98);
          box-shadow: inset 0 0 0 2px rgba(139, 0, 0, 0.28);
        }
        .a4s-card:hover {
          transform: translateY(-2px);
          border-color: #C49A2A;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
        }
        .a4s-card-photo {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: #e8e5df;
          overflow: hidden;
        }
        .a4s-card--sold .a4s-card-photo img {
          filter: grayscale(0.35) contrast(0.9);
        }
        .a4s-card-sold-ribbon {
          position: absolute;
          z-index: 4;
          top: 28%;
          left: -18%;
          width: 136%;
          transform: rotate(-10deg);
          border-top: 5px solid #8b0000;
          border-bottom: 5px solid #8b0000;
          background: rgba(139, 0, 0, 0.9);
          color: #fff7e6;
          font-family: Arial, sans-serif;
          font-size: clamp(42px, 9vw, 86px);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
          text-align: center;
          text-transform: uppercase;
          text-shadow: 0 3px 8px rgba(0, 0, 0, 0.42);
          pointer-events: none;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.25);
        }
        .a4s-card-sold-note {
          display: inline-block;
          margin: 0 0 10px;
          padding: 7px 10px;
          border: 2px solid #8b0000;
          background: #fff7e6;
          color: #8b0000;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        .a4s-card-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .a4s-card-nophoto {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: #8a8679;
          font-family: Arial, sans-serif;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .a4s-card-body {
          padding: 14px 16px 16px;
          border-top: 1px solid #1a1a1a;
        }
        .a4s-card-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }
        .a4s-card-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.2;
          margin: 0;
        }
        .a4s-card-price {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 16px;
          font-weight: 700;
          white-space: nowrap;
          color: #1a1a1a;
        }
        .a4s-card--sold .a4s-card-price {
          color: #8b0000;
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0;
          text-transform: uppercase;
        }
        .a4s-card-specs {
          margin: 10px 0 0;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 4px 10px;
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
        }
        .a4s-card-specs dt {
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6a6a6a;
          font-size: 10px;
          align-self: center;
        }
        .a4s-card-specs dd {
          margin: 0;
          text-align: right;
          font-weight: 600;
        }
        @media (max-width: 640px) {
          .a4s-card-sold-ribbon {
            top: 24%;
            font-size: clamp(34px, 18vw, 64px);
          }
          .a4s-card-body {
            padding: 12px 13px 14px;
          }
          .a4s-card-head {
            align-items: flex-start;
            gap: 6px;
          }
          .a4s-card-title {
            font-size: 17px;
            min-width: 0;
          }
          .a4s-card-price {
            font-size: 15px;
          }
          .a4s-card-specs {
            font-size: 11px;
            gap: 4px 8px;
          }
          .a4s-card-specs dt {
            font-size: 9px;
          }
        }
      `}</style>

      <a
        className={`a4s-card${isSold ? " a4s-card--sold" : ""}`}
        href={`/aircraft-for-sale/${encodeURIComponent(listing.id)}`}
        aria-label={`${headline}, ${isSold ? "sold" : priceLabel}${listing.nNumber ? `, tail ${listing.nNumber}` : ''}`}
      >
        {isSold ? <div className="a4s-card-sold-ribbon">Sold</div> : null}
        <div className="a4s-card-photo">
        {imageUrl && !imageBroken ? (
          <img
            src={imageUrl}
            srcSet={imageSrcSet}
            sizes="(max-width: 600px) 92vw, (max-width: 1024px) 45vw, 360px"
            alt={`${headline} photo`}
            loading="lazy"
            decoding="async"
            width={800}
            height={600}
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div className="a4s-card-nophoto">No photo</div>
        )}
      </div>

        <div className="a4s-card-body">
        {isSold ? <div className="a4s-card-sold-note">Sold - this aircraft has sold</div> : null}
        <div className="a4s-card-head">
          <h3 className="a4s-card-title">{headline}</h3>
          <span className="a4s-card-price">{isSold ? "Sold" : priceLabel}</span>
        </div>

        <dl className="a4s-card-specs">
          {listing.nNumber ? (
            <>
              <dt>Tail</dt>
              <dd>{listing.nNumber}</dd>
            </>
          ) : null}
          {tt ? (
            <>
              <dt>Airframe</dt>
              <dd>{tt}</dd>
            </>
          ) : null}
          {et ? (
            <>
              <dt>Engine</dt>
              <dd>{et}</dd>
            </>
          ) : null}
          {listing.sellerLocation ? (
            <>
              <dt>Location</dt>
              <dd>{listing.sellerLocation}</dd>
            </>
          ) : null}
        </dl>
        </div>
      </a>
    </>
  );
}
