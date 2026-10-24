'use client';

import { useEffect } from 'react';

export default function PortugueseDocumentLanguage({
  language = 'pt-BR',
}: {
  language?: 'pt-BR' | 'es';
}) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('rwas-language');
    } catch {}
    document.documentElement.lang =
      saved && ['en', 'pt-BR', 'es'].includes(saved) ? saved : language;
    return () => {
      document.documentElement.lang =
        saved && ['en', 'pt-BR', 'es'].includes(saved)
          ? saved
          : previous || 'en';
    };
  }, [language]);

  return null;
}
