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

  function send(event, feature, path) {
    try {
      var body = {
        sessionId: getSessionId(),
        event: event || 'feature',
        feature: feature || '',
        path: path || window.location.pathname,
        referrer: document.referrer || '',
        device: deviceClass()
      };
      var payload = JSON.stringify(body);
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/track', blob)) return;
      }
      fetch('/api/track', {
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
