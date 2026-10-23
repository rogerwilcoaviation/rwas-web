'use client';

import { useEffect } from 'react';

export default function PortugueseDocumentLanguage({
  language = 'pt-BR',
}: {
  language?: 'pt-BR' | 'es';
}) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previous || 'en';
    };
  }, [language]);

  return null;
}
