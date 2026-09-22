// Service intake is deliberately separate from chat, seller state and browser storage.
(function () {
  'use strict';
  if (window.createRwasServiceIntake) return;
  // Existing public ContactForm key (NEXT_PUBLIC_TURNSTILE_SITE_KEY), not a secret.
  var SITE_KEY = '0x4AAAAAADBTcvCdprG6EEdl';
  var challengeScript;
  function loadChallenge() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (challengeScript) return challengeScript;
    challengeScript = new Promise(function (resolve, reject) {
      var src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      var script = Array.from(document.scripts).find(function (s) { return s.src.split('?')[0] === src; });
      var own = !script;
      if (own) { script = document.createElement('script'); script.src = src + '?render=explicit'; script.async = true; }
      var timer = setTimeout(fail, 15000);
      function cleanup() { clearTimeout(timer); script.removeEventListener('load', ready); script.removeEventListener('error', fail); }
      function ready() { cleanup(); if (window.turnstile) resolve(window.turnstile); else fail(); }
      function fail() { cleanup(); if (own) script.remove(); challengeScript = null; reject(new Error('Verification unavailable')); }
      script.addEventListener('load', ready); script.addEventListener('error', fail);
      if (own) document.head.appendChild(script);
    });
    return challengeScript;
  }
  window.createRwasServiceIntake = function (panel, opener) {
    var root = document.createElement('section');
    root.hidden = true;
    root.setAttribute('aria-label', 'Service request');
    root.style.cssText = 'flex:1;min-height:0;overflow:auto;padding:12px;font:14px/1.5 Arial,sans-serif;color:#1a1a1a;background:#fffdf9;overflow-wrap:anywhere';
    // Only static markup. All customer-supplied review and response values use textContent.
    root.innerHTML = '<h2 style="font-size:18px;margin:0">Request service</h2><p>Send these details to RWAS for human review and contact about your request. This is not a booking or quote. Avoid sensitive information. <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy information</a>.</p>' +
      '<form><div data-fields></div><button type="submit">Review request</button></form>' +
      '<div data-review hidden><h3>Review your request</h3><dl></dl><p>Only the details above will be submitted, not your chat or attachments.</p><label style="display:block"><input type="checkbox" data-consent> I authorize RWAS to receive these details and contact me about this service request.</label><div data-challenge></div><button type="button" data-verify>Load verification</button><button type="button" data-edit>Edit details</button><button type="button" data-confirm disabled>Confirm and submit request</button></div>' +
      '<p data-status role="status" aria-live="polite" tabindex="-1"></p><button type="button" data-check hidden>Check notification status</button><button type="button" data-back>Back to chat</button>';
    panel.insertBefore(root, panel.querySelector('.jerry-widget-chat'));
    var form = root.querySelector('form');
    var review = root.querySelector('[data-review]');
    var status = root.querySelector('[data-status]');
    var consent = root.querySelector('[data-consent]');
    var confirm = root.querySelector('[data-confirm]');
    var edit = root.querySelector('[data-edit]');
    var verify = root.querySelector('[data-verify]');
    var check = root.querySelector('[data-check]');
    var fields = {};
    var definitions = [['name', 'Name', 'text', 120, true], ['email', 'Email', 'email', 254, true], ['phone', 'Phone (optional)', 'tel', 40, false], ['aircraft', 'Aircraft (optional)', 'text', 160, false], ['message', 'Service request', 'textarea', 8000, true]];
    definitions.forEach(function (d) {
      var label = document.createElement('label'); label.textContent = d[1]; label.style.display = 'block';
      var field = document.createElement(d[2] === 'textarea' ? 'textarea' : 'input');
      if (d[2] !== 'textarea') field.type = d[2]; else field.rows = 4;
      field.name = d[0]; field.required = d[4]; field.maxLength = d[3];
      if (d[0] === 'name') field.minLength = 2;
      if (d[0] === 'message') field.minLength = 10;
      field.style.cssText = 'display:block;box-sizing:border-box;width:100%;padding:8px;margin:4px 0 12px;font:inherit';
      label.appendChild(field); form.querySelector('[data-fields]').appendChild(label); fields[d[0]] = field;
    });
    root.querySelectorAll('button').forEach(function (button) { button.style.cssText = 'min-height:44px;margin:4px;padding:8px;max-width:100%;white-space:normal'; });
    var payload = null, fingerprint = '', requestId = '', token = '', widgetId = null;
    var receiptToken = '', receiptId = '', busy = false, accepted = false, ambiguous = false;
    var hiddenNodes = [];
    function say(text) { status.textContent = text; }
    function update() { confirm.disabled = busy || accepted || !consent.checked || !token; edit.disabled = busy; verify.disabled = busy; }
    function resetChallenge() { token = ''; if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId); update(); }
    async function verification() {
      verify.disabled = true;
      try {
        var turnstile = await loadChallenge();
        if (widgetId === null) widgetId = turnstile.render(root.querySelector('[data-challenge]'), {
          sitekey: SITE_KEY, action: 'service_intake', size: 'compact', theme: 'light',
          callback: function (value) { token = value; update(); },
          'expired-callback': function () { token = ''; update(); },
          'error-callback': function () { token = ''; say('Verification unavailable. Retry verification or call (605) 299-8178.'); update(); }
        });
        else resetChallenge();
        verify.textContent = 'Restart verification';
      } catch (_) { say('Verification unavailable. Nothing has been sent by this verification step. Retry or call (605) 299-8178.'); }
      update();
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (busy || accepted || !form.reportValidity()) return;
      var next = {};
      definitions.forEach(function (d) { next[d[0]] = fields[d[0]].value.trim(); });
      if (next.name.length < 2 || next.message.length < 10) { say('Enter a name and a request of at least 10 characters.'); return; }
      var nextFingerprint = JSON.stringify(next);
      if (nextFingerprint !== fingerprint) {
        if (!window.crypto || typeof window.crypto.randomUUID !== 'function') { say('Secure submission is unavailable in this browser. Call (605) 299-8178.'); return; }
        requestId = window.crypto.randomUUID(); fingerprint = nextFingerprint;
      }
      payload = next;
      var list = review.querySelector('dl'); list.replaceChildren();
      definitions.forEach(function (d) {
        var term = document.createElement('dt'); term.textContent = d[1]; term.style.fontWeight = 'bold';
        var value = document.createElement('dd'); value.textContent = payload[d[0]] || 'Not provided'; value.style.cssText = 'margin:0 0 8px;white-space:pre-wrap';
        list.appendChild(term); list.appendChild(value);
      });
      consent.checked = false; form.hidden = true; review.hidden = false;
      say(ambiguous ? 'An earlier attempt has an unknown outcome. Retrying unchanged details uses the same request ID; changing details may create a separate request.' : 'Review the exact details, authorize contact, then confirm submission.');
      verification();
      consent.focus();
    });
    edit.addEventListener('click', function () { if (busy || accepted) return; review.hidden = true; form.hidden = false; consent.checked = false; resetChallenge(); fields.name.focus(); });
    consent.addEventListener('change', update);
    verify.addEventListener('click', verification);
    function showReceiptStatus(value) {
      var prefix = 'Saved for human review. ';
      var descriptions = {
        notification_pending: 'Staff email notification pending; not a booking/quote.',
        provider_accepted: 'The email provider accepted the staff notification; delivery is not confirmed. Not a booking/quote.',
        delivered: 'Staff email notification delivered; this does not confirm staff review, a booking or a quote.',
        notification_failed: 'Staff email notification failed. Please call (605) 299-8178. Not a booking/quote.'
      };
      say(prefix + (descriptions[value] || 'Staff email notification status unavailable; not a booking/quote.') + ' Receipt: ' + receiptId);
    }
    confirm.addEventListener('click', async function () {
      if (busy || accepted || !payload || !consent.checked || !token) return;
      busy = true; update(); say('Submitting your reviewed request…');
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 25000);
      try {
        var response = await fetch('/api/service-intake', {
          method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({}, payload, { consent: true, requestId: requestId, turnstileToken: token, website: '' }))
        });
        var data = await response.json().catch(function () { return {}; });
        if (response.status === 202 && typeof data.receiptId === 'string' && data.receiptId && typeof data.receiptToken === 'string' && data.receiptToken) {
          accepted = true; receiptId = data.receiptId; receiptToken = data.receiptToken;
          review.hidden = true; check.hidden = false; showReceiptStatus(data.status);
          // Keep receipt capability only in this closure; never history/storage/logs/URLs.
          payload = null; definitions.forEach(function (d) { fields[d[0]].value = ''; }); review.querySelector('dl').replaceChildren();
        } else if (response.status === 400) {
          say('Request not accepted: check your details and verification, then review and try again.' + (ambiguous ? ' The earlier attempt still has an unknown outcome.' : ''));
        } else if (response.status === 409) {
          say('Request ID conflict. This attempt was not saved. Do not retry with different details to resolve a conflict; call (605) 299-8178.' + (ambiguous ? ' The earlier attempt may have been saved.' : ''));
        } else if (response.status === 503) {
          say('This attempt was not saved: service intake is unavailable. Retry unchanged details or call (605) 299-8178.' + (ambiguous ? ' The earlier attempt still has an unknown outcome.' : ''));
        } else if (response.status === 429) {
          say('Request was not accepted. Wait, complete verification again, and retry.' + (ambiguous ? ' The earlier attempt still has an unknown outcome.' : ''));
        } else {
          ambiguous = true; say('Unable to confirm whether your request was saved. Retry unchanged details to avoid a duplicate, or call (605) 299-8178.');
        }
      } catch (_) {
        ambiguous = true; say('Connection interrupted: your request may have been saved. Retry unchanged details to avoid a duplicate, or call (605) 299-8178.');
      } finally {
        clearTimeout(timer); busy = false; resetChallenge(); status.focus();
      }
    });
    check.addEventListener('click', async function () {
      if (!receiptToken || check.disabled) return;
      check.disabled = true;
      var controller = new AbortController(); var timer = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch('/api/service-receipt', { credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: { Authorization: 'Bearer ' + receiptToken } });
        if (!response.ok) throw new Error('Unavailable');
        var data = await response.json(); showReceiptStatus(data.status);
      } catch (_) { say('Saved for human review. Unable to check staff email notification status. Not a booking/quote. Receipt: ' + receiptId); }
      finally { clearTimeout(timer); check.disabled = false; }
    });
    root.querySelector('[data-back]').addEventListener('click', function () {
      root.hidden = true; hiddenNodes.forEach(function (entry) { entry.node.style.display = entry.display; }); hiddenNodes = []; opener.focus();
    });
    return { open: function () {
      if (!root.hidden) return;
      panel.querySelectorAll('.jerry-widget-chat,.jerry-widget-error,.jerry-widget-privacy,.jerry-widget-input,.jerry-service-open').forEach(function (node) { hiddenNodes.push({ node: node, display: node.style.display }); node.style.display = 'none'; });
      root.hidden = false; (accepted ? check : form.hidden ? consent : fields.name).focus();
    } };
  };
})();
