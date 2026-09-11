/* eslint-disable @next/next/no-img-element */
"use client";

// ============================================================================
// PdpImageGallery — scoped PDP photo gallery for Papa-Alpha multi-image
// products (e.g. PA-36 flap rigging tool). Renders the same broadsheet hero +
// lightbox markup as the default PDP figure, plus a thumbnail strip so every
// supplied photo is visibly browsable. Only used when the PDP opts in;
// all other products keep the existing server-rendered hero untouched.
// Accessibility: real <button> thumbnails with labels, aria-current on the
// active thumbnail, aria-live position counter. Keyboard free via buttons.
// ============================================================================

import { useRef, useState } from 'react';
import { productImageAlt, productImageUrl } from '@/lib/product-image';

export interface PdpGalleryImage {
  url: string;
  altText: string | null;
}

interface Props {
  images: PdpGalleryImage[];
  title: string;
  handle: string;
}

export function PdpImageGallery({ images, title, handle }: Props) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const total = images.length;
  const current = images[Math.min(index, total - 1)];
  if (!current) return null;
  const currentAlt = productImageAlt(current.url, current.altText, title);

  return (
    <>
      <style>{`
        .pa-gallery-open { width: 100%; border: 0; padding: 0; text-align: left; }
        .pa-gallery-dialog { border: 0; background: transparent; padding: 24px; max-width: 100vw; max-height: 100dvh; overflow: auto; }
        .pa-gallery-dialog::backdrop { background: rgba(8,13,23,.84); }
        .pa-gallery-dialog .bs-product-image-lightbox__panel { max-width: calc(100vw - 48px); }
        .pa-gallery-dialog .bs-product-image-lightbox__panel img { max-width: 100%; max-height: calc(100dvh - 110px); }
        .pa-thumb:focus-visible, .pa-gallery-open:focus-visible { outline: 3px solid #235a91; outline-offset: 3px; }
        .pa-thumbs {
          display: flex; gap: 8px;
          margin-top: 10px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .pa-thumb {
          flex: 0 0 auto;
          width: 96px; height: 72px;
          border: 2px solid rgba(26,26,26,0.25);
          background: #fff;
          overflow: hidden;
          cursor: pointer;
          padding: 0;
        }
        .pa-thumb[aria-current="true"] { border-color: #C49A2A; }
        .pa-thumb img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .pa-counter {
          font-family: Arial, sans-serif;
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--ink-500, #6b675c);
          align-self: center;
          white-space: nowrap;
        }
      `}</style>
      <button
        type="button"
        className="bs-product-image-link pa-gallery-open"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Open larger image for ${title}`}
      >
        <img
          src={productImageUrl(current.url, 800, current.altText, handle)}
          alt={currentAlt}
          width={800}
          height={600}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            background: '#fff',
          }}
          fetchPriority="high"
          decoding="async"
          loading="eager"
        />
        <span>Click image to enlarge</span>
      </button>
      <dialog
        ref={dialog}
        className="pa-gallery-dialog"
        aria-label={`Expanded image for ${title}`}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            setIndex((value) => (value + (event.key === 'ArrowRight' ? 1 : total - 1)) % total);
          }
        }}
      >
        <div className="bs-product-image-lightbox__panel">
          <button
            type="button"
            className="bs-product-image-lightbox__close"
            onClick={() => dialog.current?.close()}
            aria-label="Close expanded image"
          >
            ×
          </button>
          <img
            src={productImageUrl(current.url, 1600, current.altText, handle)}
            alt={currentAlt}
            style={{
              maxWidth: '100%',
              height: 'auto',
              display: 'block',
            }}
            loading="lazy"
            decoding="async"
          />
        </div>
      </dialog>
      <div className="pa-thumbs" aria-label="Product photo thumbnails">
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            className="pa-thumb"
            onClick={() => setIndex(i)}
            aria-label={`View photo ${i + 1} of ${total}: ${productImageAlt(img.url, img.altText, title)}`}
            aria-current={i === index ? 'true' : undefined}
          >
            <img
              src={productImageUrl(img.url, 200, img.altText, handle)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
        <span className="pa-counter" aria-live="polite">
          {index + 1} / {total}
        </span>
      </div>
    </>
  );
}
