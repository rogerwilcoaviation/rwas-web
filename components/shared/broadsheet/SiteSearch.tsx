'use client';

import Link from 'next/link';
import {
  SITE_SEARCH_GROUPS,
  searchSiteIndex,
  type SiteSearchEntry,
  type SiteSearchGroup,
} from '@/lib/site-search';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

const RESULT_LIMITS: Record<SiteSearchGroup, number> = {
  Services: 6,
  Products: 8,
  Articles: 6,
  'Planning tools': 6,
};

export type SiteSearchProps = {
  className?: string;
  buttonLabel?: string;
};

export default function SiteSearch({
  className,
  buttonLabel = 'Search',
}: SiteSearchProps) {
  const dialogId = useId();
  const inputId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<readonly SiteSearchEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open || index) return;
    let active = true;
    setLoadFailed(false);
    import('@/lib/site-search-index.generated')
      .then((module) => {
        if (active) setIndex(module.SITE_SEARCH_INDEX);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    window.requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true }),
    );
    return () => {
      active = false;
    };
  }, [index, open]);

  useEffect(() => {
    if (!open) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyLeft = document.body.style.left;
    const bodyRight = document.body.style.right;
    const bodyWidth = document.body.style.width;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    window.requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true }),
    );

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.left = bodyLeft;
      document.body.style.right = bodyRight;
      document.body.style.width = bodyWidth;
      window.scrollTo(scrollX, scrollY);
    };
  }, [open]);

  const matches = useMemo(
    () => (index ? searchSiteIndex(index, query) : []),
    [index, query],
  );

  const grouped = useMemo(
    () =>
      SITE_SEARCH_GROUPS.map((group) => {
        const all = matches.filter((match) => match.group === group);
        return {
          group,
          total: all.length,
          items: all.slice(0, RESULT_LIMITS[group]),
        };
      }).filter(({ total }) => total > 0),
    [matches],
  );

  function closeSearch(restoreFocus = true) {
    setOpen(false);
    setQuery('');
    if (restoreFocus) {
      window.requestAnimationFrame(() =>
        triggerRef.current?.focus({ preventScroll: true }),
      );
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'input, button, a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={dialogId}
        className="inline-flex min-h-11 items-center gap-2 border border-current px-3 py-2 text-sm font-bold uppercase tracking-[0.08em] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⌕</span>
        {buttonLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/55 p-2 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={inputId + '-label'}
            className="mx-auto mt-[max(0.5rem,5vh)] w-full max-w-3xl border-2 border-black bg-[#f4f0e6] p-4 text-[#181713] shadow-2xl sm:p-6"
            onKeyDown={handleDialogKeyDown}
          >
            <div className="flex items-center justify-between gap-4 border-b border-black/30 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em]">
                  Public site search
                </p>
                <p className="text-sm text-black/65">
                  Services, products, published articles, and planning tools
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 border border-black px-3 text-xl leading-none hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => closeSearch()}
                aria-label="Close search"
              >
                ×
              </button>
            </div>

            <label
              id={inputId + '-label'}
              htmlFor={inputId}
              className="mt-4 block text-sm font-bold"
            >
              Search the public RWAS site
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Try 233-20003-00, powder coating, or GFC 500…"
              className="mt-2 min-h-12 w-full rounded-none border-2 border-black bg-white px-4 py-3 text-base text-black placeholder:text-black/45 focus:outline focus:outline-2 focus:outline-offset-2"
              aria-describedby={inputId + '-coverage'}
            />
            {query ? (
              <button
                type="button"
                className="mt-2 min-h-11 border border-black px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => {
                  setQuery('');
                  window.requestAnimationFrame(() =>
                    inputRef.current?.focus({ preventScroll: true }),
                  );
                }}
              >
                Clear search
              </button>
            ) : null}
            <p
              id={inputId + '-coverage'}
              className="mt-2 text-xs text-black/60"
            >
              Searches the current public product catalog and published site
              index. Product prices are not included.
            </p>

            <div className="mt-5" aria-live="polite" aria-atomic="false">
              {!query.trim() ? (
                <p className="border-t border-black/20 pt-4 text-sm">
                  Enter a product name or part number, service, topic, or tool.
                </p>
              ) : loadFailed ? (
                <p
                  role="alert"
                  className="border-t border-black/20 pt-4 text-sm"
                >
                  Search could not load. Please use the primary navigation or
                  try again.
                </p>
              ) : !index ? (
                <p className="border-t border-black/20 pt-4 text-sm">
                  Loading public search index…
                </p>
              ) : !matches.length ? (
                <p className="border-t border-black/20 pt-4 text-sm">
                  No public results found for “{query.trim()}”. Try fewer words
                  or a part number without spaces.
                </p>
              ) : (
                <div className="space-y-5">
                  <p className="sr-only">
                    {matches.length} result{matches.length === 1 ? '' : 's'}{' '}
                    found.
                  </p>
                  {grouped.map(({ group, total, items }) => (
                    <section
                      key={group}
                      aria-labelledby={inputId + '-' + group}
                    >
                      <div className="flex items-baseline justify-between gap-3 border-b-2 border-black pb-1">
                        <h2
                          id={inputId + '-' + group}
                          className="font-serif text-lg font-black"
                        >
                          {group}
                        </h2>
                        <span className="text-xs text-black/60">
                          {total} match{total === 1 ? '' : 'es'}
                        </span>
                      </div>
                      <ul className="divide-y divide-black/15">
                        {items.map((item) => (
                          <li key={item.group + ':' + item.href}>
                            <Link
                              href={item.href}
                              className="block min-h-12 px-1 py-3 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                              onClick={() => closeSearch(false)}
                            >
                              <span className="flex flex-wrap items-center gap-2 font-bold underline decoration-black/30 underline-offset-2">
                                {item.title}
                              </span>
                              {item.skus?.length ? (
                                <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-black/65">
                                  {item.skus.join(' / ')}
                                </span>
                              ) : null}
                              <span className="mt-1 block text-sm leading-snug text-black/70">
                                {item.description}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {total > items.length && (
                        <p className="mt-2 text-xs text-black/55">
                          Showing the first {items.length} of {total} matches.
                          Refine your search for a narrower list.
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
