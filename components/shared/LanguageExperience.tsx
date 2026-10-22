'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const LANGUAGE_KEY = 'rwas-language';

type LanguageChoice = 'en' | 'pt-BR';

function translatedPaths(pathname: string) {
  if (pathname === '/services/papa-alpha-tools') {
    return { en: pathname, pt: '/pt-br/papa-alpha' };
  }
  if (pathname === '/contact') {
    return { en: pathname, pt: '/pt-br/contato' };
  }
  if (pathname === '/pt-br/papa-alpha') {
    return { en: '/services/papa-alpha-tools', pt: pathname };
  }
  if (pathname === '/pt-br/contato') {
    return {
      en: '/contact?reason=papa-alpha&source=pt-br-contact',
      pt: pathname,
    };
  }
  if (pathname.startsWith('/pt-br')) {
    return { en: '/', pt: '/pt-br/' };
  }
  return { en: pathname === '/' ? '/' : '/', pt: '/pt-br/' };
}

export default function LanguageExperience() {
  const pathname = usePathname() || '/';
  const isPortuguese = pathname === '/pt-br' || pathname.startsWith('/pt-br/');
  const paths = useMemo(() => translatedPaths(pathname), [pathname]);
  const [suggestPortuguese, setSuggestPortuguese] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    const browserLanguages = [
      ...(window.navigator.languages || []),
      window.navigator.language,
    ];
    const browserPrefersPortuguese = browserLanguages.some((language) =>
      language.toLowerCase().startsWith('pt'),
    );
    setSuggestPortuguese(
      !isPortuguese &&
        (saved === 'pt-BR' || (!saved && browserPrefersPortuguese)),
    );
  }, [isPortuguese]);

  const remember = (choice: LanguageChoice) => {
    window.localStorage.setItem(LANGUAGE_KEY, choice);
    setSuggestPortuguese(false);
  };

  return (
    <div className="fixed right-3 top-3 z-[90] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 font-sans print:hidden">
      <nav
        aria-label={isPortuguese ? 'Seleção de idioma' : 'Language selection'}
        className="rounded-full border border-slate-300 bg-white/95 p-1 text-xs font-semibold text-slate-900 shadow-md backdrop-blur dark:border-slate-600 dark:bg-slate-950/95 dark:text-white"
      >
        <Link
          href={paths.en}
          hrefLang="en-US"
          lang="en"
          aria-current={!isPortuguese ? 'page' : undefined}
          onClick={() => remember('en')}
          className={
            !isPortuguese
              ? 'inline-block rounded-full bg-slate-900 px-3 py-1.5 text-white dark:bg-white dark:text-slate-950'
              : 'inline-block rounded-full px-3 py-1.5 underline-offset-4 hover:underline focus-visible:underline'
          }
        >
          EN
        </Link>
        <Link
          href={paths.pt}
          hrefLang="pt-BR"
          lang="pt-BR"
          aria-current={isPortuguese ? 'page' : undefined}
          onClick={() => remember('pt-BR')}
          className={
            isPortuguese
              ? 'inline-block rounded-full bg-slate-900 px-3 py-1.5 text-white dark:bg-white dark:text-slate-950'
              : 'inline-block rounded-full px-3 py-1.5 underline-offset-4 hover:underline focus-visible:underline'
          }
        >
          PT-BR
        </Link>
      </nav>

      {suggestPortuguese ? (
        <section
          lang="pt-BR"
          aria-label="Sugestão de idioma"
          aria-live="polite"
          className="w-[min(23rem,calc(100vw-1.5rem))] rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-slate-950 shadow-lg"
        >
          <p className="font-semibold">Prefere navegar em português?</p>
          <p className="mt-1">
            A versão em português está disponível. Você decide; não
            redirecionamos automaticamente.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={paths.pt}
              hrefLang="pt-BR"
              onClick={() => remember('pt-BR')}
              className="rounded bg-slate-900 px-3 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Ver em português
            </Link>
            <button
              type="button"
              onClick={() => remember('en')}
              className="rounded border border-slate-400 px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Continuar em inglês
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
