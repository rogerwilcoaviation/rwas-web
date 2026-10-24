'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { languageForPath, LANGUAGES } from '@/lib/site-language.mjs';
type Language = 'en' | 'pt-BR' | 'es';
export default function LanguageExperience() {
  const pathname = usePathname() || '/';
  const [language, setLanguage] = useState<Language>(languageForPath(pathname));
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState('');
  const container = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setStatus('');
    const place = () => {
      const anchor =
        document.querySelector('.bs-credentials') ||
        document.querySelector('.bs-masthead') ||
        document.querySelector('header');
      const main = document.querySelector('main');
      const element = container.current || document.createElement('div');
      element.className = 'site-language-slot';
      element.dataset.siteLanguageSlot = 'true';
      if (anchor && element.previousElementSibling !== anchor)
        anchor.insertAdjacentElement('afterend', element);
      else if (!anchor && main && element.nextElementSibling !== main)
        main.insertAdjacentElement('beforebegin', element);
      if (!element.isConnected) return;
      container.current = element;
      setHost(element);
    };
    place();
    const observer = new MutationObserver(() => {
      if (!container.current?.isConnected) place();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('rwas-language');
    } catch {}
    const choice =
      saved && LANGUAGES.includes(saved) ? saved : languageForPath(pathname);
    setLanguage(choice as Language);
    document.documentElement.lang = choice;
    window.dispatchEvent(new CustomEvent('rwas:language-route'));
    if (!document.querySelector('script[data-site-language-runtime]')) {
      const script = document.createElement('script');
      script.dataset.siteLanguageRuntime = 'true';
      script.src = '/site-language.js?v=20261024-sitewide-v2';
      script.async = true;
      document.head.appendChild(script);
    }
    const changed = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (LANGUAGES.includes(detail?.language)) setLanguage(detail.language);
    };
    const progress = (event: Event) =>
      setStatus((event as CustomEvent).detail?.status || '');
    window.addEventListener('rwas:language-changed', changed);
    window.addEventListener('rwas:language-status', progress);
    return () => {
      observer.disconnect();
      window.removeEventListener('rwas:language-changed', changed);
      window.removeEventListener('rwas:language-status', progress);
    };
  }, [pathname]);
  function choose(choice: Language) {
    try {
      localStorage.setItem('rwas-language', choice);
    } catch {}
    setLanguage(choice);
    setStatus('');
    document.documentElement.lang = choice;
    window.dispatchEvent(
      new CustomEvent('rwas:language-changed', {
        detail: { language: choice },
      }),
    );
  }
  return (
    <>
      {host &&
        createPortal(
          <div
            className="lang-switcher"
            data-site-language-control
            translate="no"
          >
            <nav aria-label="Language selection">
              {(['en', 'pt-BR', 'es'] as Language[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  lang={choice}
                  aria-label={
                    choice === 'en'
                      ? 'English'
                      : choice === 'pt-BR'
                        ? 'Português do Brasil'
                        : 'Español'
                  }
                  aria-pressed={language === choice}
                  onClick={() => choose(choice)}
                >
                  {choice === 'en' ? 'EN' : choice === 'pt-BR' ? 'PT-BR' : 'ES'}
                </button>
              ))}
            </nav>
            {status && (
              <p role="status">
                {status}
                {status.includes('unavailable') && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('rwas:language-retry'),
                      )
                    }
                  >
                    Retry
                  </button>
                )}
              </p>
            )}
          </div>,
          host,
        )}
      <style jsx global>{`
        .site-language-slot {
          width: 100%;
          box-sizing: border-box;
          position: relative;
          z-index: 5;
          background: #f7f4ed;
          border-bottom: 1px solid #d8d0bc;
          min-height: 52px;
        }
        .lang-switcher {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          max-width: 1160px;
          margin: 0 auto;
          padding: 8px 20px;
          font:
            13px/1.4 Arial,
            sans-serif;
          color: #25231f;
        }
        .lang-switcher nav {
          display: flex;
          gap: 2px;
          background: #fff;
          border: 1px solid #bbb4a5;
          border-radius: 24px;
          padding: 3px;
        }
        .lang-switcher button {
          min-height: 36px;
          padding: 8px 14px;
          border: 0;
          border-radius: 20px;
          background: transparent;
          color: inherit;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        .lang-switcher button[aria-pressed='true'] {
          background: #222;
          color: #fff;
        }
        .lang-switcher button:focus-visible {
          outline: 3px solid #a17c13;
          outline-offset: 2px;
        }
        .lang-switcher p {
          font-size: 12px;
          margin: 0;
          max-width: 420px;
        }
        @media (max-width: 600px) {
          .lang-switcher {
            padding: 8px 12px;
            justify-content: flex-end;
            gap: 6px;
          }
          .lang-switcher p {
            flex-basis: 100%;
            text-align: right;
          }
        }
        @media print {
          .site-language-slot {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
