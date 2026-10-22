'use client';

import { useEffect } from 'react';

export default function PortugueseDocumentLanguage() {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = 'pt-BR';
    return () => {
      document.documentElement.lang = previous || 'en';
    };
  }, []);

  return null;
}
