'use client';

import Link from 'next/link';
import { useState } from 'react';

const PAPA_ALPHA_DEMOS = [
  {
    id: 'xTl1IJ-KmQY',
    title: 'Bellcrank Reference Tools',
    description:
      'An illustrated overview of a general workflow using Papa-Alpha bellcrank reference tools to establish repeatable rigging reference conditions.',
    productHref: '/products/bell-crank-rigging-tool',
    productLabel: 'View bellcrank tools',
  },
  {
    id: '0mX3w7Ty39k',
    title: 'Rudder Reference Tools',
    description:
      'An illustrated overview of using a shaped rudder reference tool to compare the fixed fin and rudder at the travel stops.',
    productHref: '/products/rudder-rigging-tool',
    productLabel: 'View rudder tools',
  },
  {
    id: 'ihc7ni6thro',
    title: 'Stabilator Reference Tool',
    description:
      'An illustrated overview of using a contour-matched stabilator reference tool as a repeatable datum for general measurement checks.',
    productHref: '/products/stabilator-rigging-tool',
    productLabel: 'View stabilator tools',
  },
] as const;

export function PapaAlphaDemoGallery() {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  return (
    <>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PAPA_ALPHA_DEMOS.map((demo) => {
          const isActive = activeVideoId === demo.id;
          const thumbnailUrl = `https://i.ytimg.com/vi/${demo.id}/hqdefault.jpg`;

          return (
            <article
              key={demo.id}
              className="flex min-w-0 flex-col overflow-hidden border border-black/20 bg-[#fbf8ef] shadow-[0_12px_30px_rgba(46,38,30,0.10)]"
            >
              <div className="relative aspect-video overflow-hidden bg-[#15110d]">
                {isActive ? (
                  <iframe
                    className="absolute inset-0 h-full w-full border-0"
                    src={`https://www.youtube-nocookie.com/embed/${demo.id}?autoplay=1&rel=0`}
                    title={`${demo.title} demonstration`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    className="group absolute inset-0 h-full w-full cursor-pointer overflow-hidden bg-[#15110d] text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[#c49a2a]"
                    onClick={() => setActiveVideoId(demo.id)}
                    aria-label={`Play ${demo.title} demonstration`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center px-6 text-center font-semibold uppercase tracking-[0.14em] text-[#efe6d2]"
                    >
                      Papa-Alpha tool demonstration
                    </span>
                    {/* A plain image provides an on-error fallback without adding a new Next image host. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] group-focus-visible:scale-[1.025]"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/15 transition group-hover:from-black/75"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/70 text-white shadow-lg transition group-hover:scale-105 group-hover:bg-[#9f1f21] group-focus-visible:scale-105 group-focus-visible:bg-[#9f1f21]">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="ml-1 h-7 w-7 fill-current"
                        >
                          <path d="M8 5.5v13l10-6.5z" />
                        </svg>
                      </span>
                    </span>
                    <span className="absolute bottom-3 left-3 right-3 text-sm font-bold uppercase tracking-[0.08em] text-white drop-shadow-md">
                      Play demonstration
                    </span>
                  </button>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-xl font-bold leading-tight text-[#17130f]">
                  {demo.title}
                </h3>
                <p className="mt-3 flex-1 text-[0.98rem] leading-7 text-[#40372e]">
                  {demo.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-4">
                  <Link
                    href={demo.productHref}
                    className="font-bold text-[#7c1e20] underline decoration-[#c49a2a] decoration-2 underline-offset-4 hover:text-[#111318] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1e20]"
                  >
                    {demo.productLabel}
                  </Link>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => setActiveVideoId(null)}
                      className="text-sm font-semibold text-[#40372e] underline decoration-black/30 underline-offset-4 hover:text-[#7c1e20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1e20]"
                    >
                      Close video
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-6 border-l-4 border-[#c49a2a] bg-[#f3ecdc] px-4 py-3 text-sm leading-6 text-[#40372e]">
        These demonstrations are general overviews, not aircraft-specific
        maintenance instructions or approved data. Confirm tool applicability
        and follow current applicable maintenance data and product instructions.
      </p>
    </>
  );
}
