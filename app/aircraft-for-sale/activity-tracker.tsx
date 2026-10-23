'use client';
import { useEffect } from 'react';
export default function ActivityTracker() {
  useEffect(() => {
    if (document.querySelector('script[data-exchange-activity]')) return;
    const script = document.createElement('script');
    script.dataset.exchangeActivity = 'true';
    script.src = '/aviation-exchange-activity.js?v=20261023-activity-content';
    script.async = true;
    document.head.appendChild(script);
  }, []);
  return null;
}
