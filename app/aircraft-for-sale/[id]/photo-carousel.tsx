/* eslint-disable @next/next/no-img-element */
// ============================================================================
// PhotoCarousel (client component) — photo gallery for /aircraft-for-sale/[id]
//
// Accessibility: real <button> prev/next controls with aria-labels, keyboard
// arrow-key support, lazy-loaded <img>. Graceful fallback to "No photo"
// when the list is empty or all images 404.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  photoUrls: string[];
  alt: string;
}

export function PhotoCarousel({ photoUrls, alt }: Props) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const total = photoUrls.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);
  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(document.activeElement)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const markBroken = (i: number) => {
    setBroken((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  if (!total) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "4 / 3",
          background: "#e8e5df",
          border: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8a8679",
          fontFamily: "Arial, sans-serif",
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        No photos
      </div>
    );
  }

  const currentBroken = broken.has(index);
  const currentUrl = photoUrls[index];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label={`${alt} photo gallery`}
      style={{ outline: "none" }}
    >
      <style>{`
        .a4s-pc-main {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border: 1px solid #1a1a1a;
          background: #e8e5df;
          overflow: hidden;
        }
        .a4s-pc-main img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .a4s-pc-broken {
          display: flex; width: 100%; height: 100%;
          align-items: center; justify-content: center;
          color: #8a8679;
          font-family: Arial, sans-serif;
          font-size: 12px; letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .a4s-pc-btn {
          position: absolute;
          top: 50%; transform: translateY(-50%);
          background: rgba(26,26,26,0.65);
          color: #fff;
          border: 0;
          width: 40px; height: 40px;
          font-size: 20px; font-weight: 700;
          cursor: pointer;
          line-height: 1;
        }
        .a4s-pc-btn:hover { background: rgba(196,154,42,0.85); color: #111; }
        .a4s-pc-btn.prev { left: 8px; }
        .a4s-pc-btn.next { right: 8px; }
        .a4s-pc-counter {
          position: absolute;
          bottom: 8px; right: 10px;
          background: rgba(26,26,26,0.65);
          color: #fff;
          padding: 3px 8px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          letter-spacing: 0.06em;
        }
        .a4s-pc-thumbs {
          display: flex; gap: 6px;
          margin-top: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .a4s-pc-thumb {
          flex: 0 0 auto;
          width: 72px; height: 54px;
          border: 2px solid transparent;
          background: #e8e5df;
          overflow: hidden;
          cursor: pointer;
          padding: 0;
        }
        .a4s-pc-thumb.active { border-color: #C49A2A; }
        .a4s-pc-thumb img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
      `}</style>

      <div className="a4s-pc-main">
        {currentBroken ? (
          <div className="a4s-pc-broken">Photo unavailable</div>
        ) : (
          <img
            key={currentUrl}
            src={currentUrl}
            alt={`${alt} — photo ${index + 1} of ${total}`}
            loading={index === 0 ? "eager" : "lazy"}
            onError={() => markBroken(index)}
          />
        )}
        {total > 1 ? (
          <>
            <button
              type="button"
              className="a4s-pc-btn prev"
              onClick={goPrev}
              aria-label="Previous photo"
            >
              &larr;
            </button>
            <button
              type="button"
              className="a4s-pc-btn next"
              onClick={goNext}
              aria-label="Next photo"
            >
              &rarr;
            </button>
            <div className="a4s-pc-counter" aria-live="polite">
              {index + 1} / {total}
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="a4s-pc-thumbs" role="tablist" aria-label="Photo thumbnails">
          {photoUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`a4s-pc-thumb${i === index ? " active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1} of ${total}`}
              aria-selected={i === index}
              role="tab"
            >
              {broken.has(i) ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    fontSize: 10,
                    color: "#8a8679",
                  }}
                >
                  ×
                </span>
              ) : (
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  onError={() => markBroken(i)}
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
