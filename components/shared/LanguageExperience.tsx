'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const LANGUAGE_KEY = 'rwas-language';

type LanguageChoice = 'en' | 'pt-BR' | 'es';

type LanguagePaths = { en: string; pt: string; es: string };

function translatedPaths(pathname: string): LanguagePaths {
  if (pathname === '/services/papa-alpha-tools') {
    return { en: pathname, pt: '/pt-br/papa-alpha', es: '/es/papa-alpha' };
  }
  if (pathname === '/contact') {
    return { en: pathname, pt: '/pt-br/contato', es: '/es/contacto' };
  }
  if (pathname === '/pt-br/papa-alpha') {
    return {
      en: '/services/papa-alpha-tools',
      pt: pathname,
      es: '/es/papa-alpha',
    };
  }
  if (pathname === '/pt-br/contato') {
    return {
      en: '/contact?reason=papa-alpha&source=pt-br-contact',
      pt: pathname,
      es: '/es/contacto',
    };
  }
  if (pathname === '/es/papa-alpha') {
    return {
      en: '/services/papa-alpha-tools',
      pt: '/pt-br/papa-alpha',
      es: pathname,
    };
  }
  if (pathname === '/es/contacto') {
    return {
      en: '/contact?reason=papa-alpha&source=es-contact',
      pt: '/pt-br/contato',
      es: pathname,
    };
  }
  if (pathname.startsWith('/pt-br')) {
    return { en: '/', pt: '/pt-br/', es: '/es/' };
  }
  if (pathname.startsWith('/es')) {
    return { en: '/', pt: '/pt-br/', es: '/es/' };
  }
  return { en: pathname === '/' ? '/' : '/', pt: '/pt-br/', es: '/es/' };
}

export default function LanguageExperience() {
  const pathname = usePathname() || '/';
  const isPortuguese = pathname === '/pt-br' || pathname.startsWith('/pt-br/');
  const isSpanish = pathname === '/es' || pathname.startsWith('/es/');
  const paths = useMemo(() => translatedPaths(pathname), [pathname]);
  const [suggestedLanguage, setSuggestedLanguage] = useState<
    'pt-BR' | 'es' | null
  >(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    const browserLanguages = [
      ...(window.navigator.languages || []),
      window.navigator.language,
    ];
    const browserLanguage = browserLanguages
      .map((language) => language.toLowerCase())
      .find(
        (language) => language.startsWith('pt') || language.startsWith('es'),
      );
    const suggestion =
      saved === 'pt-BR' || saved === 'es'
        ? saved
        : !saved && browserLanguage?.startsWith('pt')
          ? 'pt-BR'
          : !saved && browserLanguage?.startsWith('es')
            ? 'es'
            : null;
    setSuggestedLanguage(
      (suggestion === 'pt-BR' && !isPortuguese) ||
        (suggestion === 'es' && !isSpanish)
        ? suggestion
        : null,
    );
  }, [isPortuguese, isSpanish]);

  const remember = (choice: LanguageChoice) => {
    window.localStorage.setItem(LANGUAGE_KEY, choice);
    setSuggestedLanguage(null);
  };

  return (
    <div className="fixed left-3 top-3 z-[90] sm:left-auto sm:right-3 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 font-sans print:hidden">
      <nav
        aria-label={
          isPortuguese
            ? 'Seleção de idioma'
            : isSpanish
              ? 'Selección de idioma'
              : 'Language selection'
        }
        className="rounded-full border border-slate-300 bg-white/95 p-1 text-xs font-semibold text-slate-900 shadow-md backdrop-blur dark:border-slate-600 dark:bg-slate-950/95 dark:text-white"
      >
        <Link
          href={paths.en}
          hrefLang="en-US"
          lang="en"
          aria-current={!isPortuguese && !isSpanish ? 'page' : undefined}
          onClick={() => remember('en')}
          className={
            !isPortuguese && !isSpanish
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
        <Link
          href={paths.es}
          hrefLang="es"
          lang="es"
          aria-current={isSpanish ? 'page' : undefined}
          onClick={() => remember('es')}
          className={
            isSpanish
              ? 'inline-block rounded-full bg-slate-900 px-3 py-1.5 text-white dark:bg-white dark:text-slate-950'
              : 'inline-block rounded-full px-3 py-1.5 underline-offset-4 hover:underline focus-visible:underline'
          }
        >
          ES
        </Link>
      </nav>

      {suggestedLanguage ? (
        <section
          lang={suggestedLanguage}
          aria-label={
            suggestedLanguage === 'pt-BR'
              ? 'Sugestão de idioma'
              : 'Sugerencia de idioma'
          }
          aria-live="polite"
          className="w-[min(23rem,calc(100vw-1.5rem))] rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-slate-950 shadow-lg"
        >
          <p className="font-semibold">
            {suggestedLanguage === 'pt-BR'
              ? 'Prefere navegar em português?'
              : '¿Prefiere navegar en español?'}
          </p>
          <p className="mt-1">
            {suggestedLanguage === 'pt-BR'
              ? 'A versão em português está disponível. Você decide; não redirecionamos automaticamente.'
              : 'La versión en español está disponible. Usted decide; no redirigimos automáticamente.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={suggestedLanguage === 'pt-BR' ? paths.pt : paths.es}
              hrefLang={suggestedLanguage}
              onClick={() => remember(suggestedLanguage)}
              className="rounded bg-slate-900 px-3 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {suggestedLanguage === 'pt-BR'
                ? 'Ver em português'
                : 'Ver en español'}
            </Link>
            <button
              type="button"
              onClick={() => remember('en')}
              className="rounded border border-slate-400 px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {suggestedLanguage === 'pt-BR'
                ? 'Continuar em inglês'
                : 'Continuar en inglés'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
