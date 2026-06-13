'use client';

import { useEffect } from 'react';
import { deferUntilIdle } from './deferUntilIdle';

const JERRY_WIDGET_SRC = '/jerry-widget.js?v=20260422';

export default function DeferredJerryWidget() {
  useEffect(() => {
    if (document.querySelector(`script[src="${JERRY_WIDGET_SRC}"]`)) {
      return undefined;
    }

    const cancelDeferredLoad = deferUntilIdle(() => {
      const script = document.createElement('script');
      script.src = JERRY_WIDGET_SRC;
      script.async = true;
      document.body.appendChild(script);
    });

    return cancelDeferredLoad;
  }, []);

  return null;
}
