(function () {
  'use strict';
  if (window.__aviationExchangeActivity || !/^\/aircraft-for-sale(?:\/|$)|^\/aircraft4sale\/?$/.test(location.pathname)) return;
  window.__aviationExchangeActivity = true;
  var endpoint = '/api/aircraft-sale/activity', queue = [], timer, sending = false;
  var nativeFetch = window.fetch.bind(window);
  function accountRef() {
    var session = window.rwasSaleSession;
    return session && session.identityUserId || (window.rwasSellerAuthReady && !session ? '' : undefined);
  }
  async function headersFor(path, expectedRef) {
    var current = window.rwasSaleSession;
    if (!current || typeof window.rwasSellerRequestHeaders !== 'function') return {};
    if (expectedRef && expectedRef !== current.identityUserId) throw new Error('Activity account changed');
    var headers = await window.rwasSellerRequestHeaders(path);
    if (window.rwasSaleSession !== current) throw new Error('Activity account changed');
    return headers;
  }
  function currentPage() { return location.pathname.replace(/\/$/, '') || '/aircraft-for-sale'; }
  function context(element) {
    if (element && element.closest('.jerry-widget,#jerry-widget-panel')) return 'jerry';
    if (element && element.closest('.listing-workflow')) return 'draft';
    if (element && element.closest('.exchange-log,[aria-label="Administrator index"]')) return 'admin';
    if (element && element.closest('.account-workspace')) return 'account';
    return currentPage() === '/aircraft-for-sale' ? 'marketplace' : 'listing';
  }
  function push(action, details) {
    if (!/^\/aircraft-for-sale(?:\/|$)|^\/aircraft4sale\/?$/.test(location.pathname)) return;
    var stepElement = document.querySelector('[data-exchange-step]');
    if (stepElement && !(details && details.step !== undefined)) details = Object.assign({ step: Number(stepElement.getAttribute('data-exchange-step')) }, details || {});
    queue.push(Object.assign({ action: action, page: currentPage(), clientAt: Date.now(), accountRef: accountRef() }, details || {}));
    if (queue.length > 100) queue.shift();
    if (!timer) timer = setTimeout(function () { timer = null; flush(false); }, 1500);
  }
  function flush(leaving) {
    if (!queue.length || sending && !leaving) return;
    var events = queue.splice(0, 20), body = JSON.stringify({ events: events });
    sending = true;
    // HttpOnly identity cookie is verified by the server. No identity claim or
    // credential is read from storage or accepted from these event objects.
    headersFor(endpoint).catch(function () { return {}; }).then(function (headers) {
      return nativeFetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: body });
    })
      .then(function (response) { if (response.status >= 500 && !leaving) queue = events.concat(queue).slice(-100); })
      .catch(function () { if (!leaving) queue = events.concat(queue).slice(-100); })
      .finally(function () { sending = false; if (queue.length && !leaving && !timer) timer = setTimeout(function () { timer = null; flush(false); }, 5000); });
  }
  var labels = {
    'create a listing': 'create-listing', 'resume saved draft': 'resume-draft',
    'list manually': 'manual', 'start manually': 'manual', 'resume manually': 'manual',
    'use jerry': 'jerry', 'resume with jerry': 'jerry', 'continue with jerry': 'jerry',
    'sign in': 'sign-in', 'user login': 'sign-in', 'sign out': 'sign-out',
    'create an account': 'create-account', 'create account': 'create-account',
    'forgot password': 'forgot-password', 'forgot password?': 'forgot-password',
    'save draft': 'save-draft', 'continue': 'continue', 'back': 'back',
    'review draft': 'review-draft', 'submit for approval': 'submit-listing',
    'email seller': 'contact-seller', 'refresh log': 'refresh',
    'apply filters': 'filter', 'clear filters': 'filter',
    'close': 'close', 'approve': 'approve', 'reject': 'reject',
    'delete': 'delete', 'permanently delete listing': 'delete',
    'upload': 'upload', 'add photos': 'photo'
  };
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target.closest('button,a,[role="tab"]') : null;
    if (!target || target.closest('.lang-switcher,[aria-label="Language"]')) return;
    // Use text only to select a fixed label; unknown text/href never leaves here.
    var label = (target.textContent || '').trim().toLowerCase();
    var control = target.matches('[role="tab"]') ? 'tab' : target.matches('.jerry-widget-send') ? 'chat-send' : (Object.prototype.hasOwnProperty.call(labels, label) ? labels[label] : null) || (target.tagName === 'A' ? 'link' : 'button');
    push('control.click', { control: control, context: context(target) });
  }, true);
  document.addEventListener('change', function (event) {
    var target = event.target;
    if (!(target instanceof Element) || !target.matches('input,textarea,select')) return;
    // No values, names, filenames or free-text content are collected.
    push('field.change', { control: 'field', context: context(target) });
  }, true);
  document.addEventListener('submit', function (event) { push('form.submit', { control: 'form', context: context(event.target) }); }, true);
  var lastStep = '';
  function trackStep() {
    var el = document.querySelector('[data-exchange-step]');
    if (!el) { lastStep = ''; return; }
    var step = el.getAttribute('data-exchange-step');
    if (step !== lastStep) { lastStep = step; push('draft.step', { context: 'draft', step: Number(step) }); }
  }
  var observer = new MutationObserver(trackStep);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-exchange-step'] });
  window.addEventListener('error', function (event) { push('client.error', { errorKind: event.target === window ? 'unhandled-error' : 'resource-error' }); }, true);
  window.addEventListener('unhandledrejection', function () { push('client.error', { errorKind: 'unhandled-rejection' }); });
  var conversationOwner, conversationId;
  function conversationKey(owner) {
    var key = owner || 'visitor';
    if (conversationOwner === key && conversationId) return conversationId;
    conversationOwner = key;
    try {
      var saved = JSON.parse(sessionStorage.getItem('aviation-exchange-conversation') || 'null');
      conversationId = saved && saved.owner === key ? saved.id : crypto.randomUUID();
      sessionStorage.setItem('aviation-exchange-conversation', JSON.stringify({ owner: key, id: conversationId }));
    } catch (_) { conversationId = crypto.randomUUID(); }
    return conversationId;
  }
  async function boundedText(response) {
    if (!response.body) return '';
    var reader = response.body.getReader(), decoder = new TextDecoder(), result = '', bytes = 0;
    try {
      for (;;) {
        var part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 64000) { reader.cancel().catch(function () {}); break; }
        result += decoder.decode(part.value, { stream: true });
      }
      return result + decoder.decode();
    } finally { reader.releaseLock(); }
  }
  async function captureConversation(input, init, response, snapshot) {
    try {
      var raw = init && init.body;
      if (typeof raw !== 'string' && input instanceof Request) raw = await boundedText(input.clone());
      if (typeof raw !== 'string' || raw.length > 64000) return;
      var payload = JSON.parse(raw), messages = payload.messages || [];
      var last = messages.filter(function (m) { return m.role === 'user' && typeof m.content === 'string'; }).pop();
      if (!last) return;
      var text = response ? await boundedText(response) : '', assistant = '';
      if (response && (response.headers.get('content-type') || '').indexOf('text/event-stream') !== -1) {
        text.split('\n').forEach(function (line) {
          if (line.indexOf('data: ') !== 0) return;
          try { var item = JSON.parse(line.slice(6)); if (item.token) assistant += item.token; if (item.cleanReply) assistant = item.cleanReply; } catch (_) {}
        });
      } else {
        try { var data = JSON.parse(text); assistant = data.cleanReply || data.reply || data.message || data.content || ''; } catch (_) {}
      }
      var headers = await headersFor(endpoint + '/conversation', snapshot.accountRef);
      await nativeFetch(endpoint + '/conversation', { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify({ page: snapshot.page, accountRef: snapshot.accountRef, clientAt: snapshot.clientAt, id: snapshot.id, user: last.content.split('\n\n[System context:')[0].slice(0,5000), assistant: String(assistant).slice(0,12000), truncated: last.content.split('\n\n[System context:')[0].length > 5000 || String(assistant).length > 12000, status: response ? response.status : 0, requestId: response && response.headers.get('X-RWAS-Request-ID') || undefined }) });
    } catch (_) { /* Conversation logging must not interrupt Jerry or leak diagnostics. */ }
  }
  window.fetch = function (input, init) {
    var url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href); } catch (_) { return nativeFetch(input, init); }
    var chatOrigin = url.origin === location.origin || url.protocol === 'https:' && ['rogerwilcoaviation.com','www.rogerwilcoaviation.com'].indexOf(url.hostname) !== -1;
    var relevant = url.origin === location.origin && url.pathname.indexOf('/api/aircraft-sale/') === 0 || chatOrigin && url.pathname === '/api/chat';
    var chat = url.pathname === '/api/chat', started = Date.now();
    var inMarketplace = /^\/aircraft-for-sale(?:\/|$)|^\/aircraft4sale\/?$/.test(location.pathname);
    var snapshot = relevant && chat && inMarketplace ? { page: currentPage(), accountRef: accountRef(), clientAt: started } : null;
    if (snapshot) snapshot.id = conversationKey(snapshot.accountRef);
    var transcriptInput = snapshot && input instanceof Request ? input.clone() : input;
    return nativeFetch(input, init).then(function (response) {
      if (snapshot) push('chat.request', { context: 'jerry', accountRef: snapshot.accountRef, clientAt: snapshot.clientAt, status: response.status, durationMs: Date.now() - started, requestId: response.headers.get('X-RWAS-Request-ID') || undefined });
      if (snapshot) void captureConversation(transcriptInput, init, response.clone(), snapshot);
      return response;
    }, function (error) {
      if (relevant && inMarketplace && url.pathname !== endpoint) push('request.network-error', { errorKind: 'network-error', durationMs: Date.now() - started });
      if (snapshot) void captureConversation(transcriptInput, init, null, snapshot);
      throw error;
    });
  };
  window.addEventListener('pagehide', function () { push('page.leave'); flush(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('online', function () { flush(false); });
  var lastPage = currentPage();
  function navigation() {
    var next = currentPage();
    if (next !== lastPage) { lastPage = next; push('page.view'); }
  }
  ['pushState','replaceState'].forEach(function (key) {
    var original = history[key];
    history[key] = function () { var result = original.apply(this, arguments); navigation(); return result; };
  });
  window.addEventListener('popstate', navigation);
  push('page.view', { viewport: innerWidth < 600 ? 'small' : innerWidth < 1000 ? 'medium' : 'large' });
  trackStep();
})();
