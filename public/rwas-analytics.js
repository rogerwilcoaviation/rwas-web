(function () {
  'use strict';

  var KEY = 'rwas_anon_session';

  function getSessionId() {
    try {
      var existing = window.localStorage.getItem(KEY);
      if (existing && /^rwas_[a-z0-9_-]{12,80}$/i.test(existing)) return existing;
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      var id = 'rwas_' + Array.prototype.map.call(bytes, function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
      window.localStorage.setItem(KEY, id);
      return id;
    } catch (_) {
      return 'rwas_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  function deviceClass() {
    var w = window.innerWidth || 0;
    if (w && w < 720) return 'mobile';
    if (w && w < 1100) return 'tablet';
    return 'desktop';
  }

  function send(event, feature, path, extra) {
    try {
      var endpoint = '/api/track';
      var body = {
        sessionId: getSessionId(),
        event: event || 'feature',
        feature: feature || '',
        path: path || window.location.pathname,
        referrer: document.referrer || '',
        device: deviceClass()
      };
      if (extra && typeof extra === 'object') {
        Object.keys(extra).forEach(function (key) {
          if (extra[key] !== undefined && extra[key] !== null) body[key] = extra[key];
        });
      }
      var payload = JSON.stringify(body);
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () {});
    } catch (_) {}
  }

  function inferFeature(el) {
    if (!el) return '';
    var explicit = el.closest && el.closest('[data-rwas-track]');
    if (explicit) return explicit.getAttribute('data-rwas-track') || '';

    var hrefEl = el.closest && el.closest('a[href]');
    var href = hrefEl ? hrefEl.getAttribute('href') || '' : '';
    var text = ((hrefEl || el).textContent || '').trim().toLowerCase();
    var cls = ((hrefEl || el).className || '').toString().toLowerCase();

    if (href.indexOf('/garmin') === 0) return 'garmin_page_link';
    if (href.indexOf('/collections') === 0 || href.indexOf('/products') === 0) return 'shop_link';
    if (href.indexOf('/aircraft-for-sale') === 0) return 'aircraft_sale_link';
    if (href.indexOf('/panel-planner') === 0 || text.indexOf('panel planner') >= 0) return 'panel_planner_link';
    if (text.indexOf('contact') >= 0 || text.indexOf('quote') >= 0) return 'contact_or_quote';
    if (cls.indexOf('jerry-widget') >= 0) return 'chat_widget';
    if (cls.indexOf('cart') >= 0) return 'cart';
    return '';
  }

  window.rwasTrack = send;
  send('pageview', '', window.location.pathname);

  function rating(name, value) {
    if (name === 'LCP') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    if (name === 'CLS') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    if (name === 'FCP') return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    if (name === 'TTFB') return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    return '';
  }

  function sendVital(name, value, extra) {
    if (typeof value !== 'number' || !isFinite(value)) return;
    send('web_vital', name, window.location.pathname, Object.assign({
      metric: name,
      value: Math.round(value * 1000) / 1000,
      rating: rating(name, value),
      visibilityState: document.visibilityState || ''
    }, extra || {}));
  }

  function observeVitals() {
    if (!('PerformanceObserver' in window)) return;

    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && typeof nav.responseStart === 'number') {
        sendVital('TTFB', nav.responseStart, {
          navigationType: nav.type || '',
          transferSize: nav.transferSize || 0
        });
      }
    } catch (_) {}

    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (entry.name === 'first-contentful-paint') sendVital('FCP', entry.startTime);
        });
      }).observe({ type: 'paint', buffered: true });
    } catch (_) {}

    try {
      var lcpEntry;
      var lcpObserver = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        lcpEntry = entries[entries.length - 1] || lcpEntry;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      var flushLcp = function () {
        if (!lcpEntry) return;
        sendVital('LCP', lcpEntry.startTime, {
          element: lcpEntry.element && lcpEntry.element.tagName ? lcpEntry.element.tagName.toLowerCase() : '',
          url: lcpEntry.url || '',
          size: lcpEntry.size || 0
        });
        try { lcpObserver.disconnect(); } catch (_) {}
        lcpEntry = null;
      };
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushLcp();
      });
      window.addEventListener('pagehide', flushLcp);
    } catch (_) {}

    try {
      var cls = 0;
      var clsObserver = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) cls += entry.value || 0;
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      var clsSent = false;
      var flushCls = function () {
        if (clsSent) return;
        clsSent = true;
        sendVital('CLS', cls);
        try { clsObserver.disconnect(); } catch (_) {}
      };
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushCls();
      });
      window.addEventListener('pagehide', flushCls);
    } catch (_) {}
  }

  observeVitals();

  document.addEventListener('click', function (evt) {
    var target = evt.target;
    var feature = inferFeature(target);
    if (!feature) return;
    var event = 'feature';
    if (feature === 'chat_widget') event = 'chat_open';
    if (feature === 'cart') event = 'cart_add';
    if (feature.indexOf('panel_planner') >= 0) event = 'panel_planner';
    if (feature.indexOf('aircraft_sale') >= 0) event = 'aircraft_sale';
    send(event, feature, window.location.pathname);
  }, { capture: true, passive: true });
})();
