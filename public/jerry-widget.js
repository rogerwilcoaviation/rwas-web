(function () {
  if (window.__jerryWidgetLoaded) return;
  window.__jerryWidgetLoaded = true;
  window.openJerryChat = function() {};

  var isShopify = typeof window.Shopify !== 'undefined';

  if (isShopify) {
    function forceShopifyHeaderMatch() {
      var section = document.getElementById('shopify-section-sections--20057122865371__header') || document.querySelector('[id^="shopify-section-"]');
      if (!section) return false;
      var page = section.querySelector('.np-page');
      if (!page) return false;
      section.style.setProperty('background', '#ddd9d2', 'important');
      section.style.setProperty('padding', '20px 0', 'important');
      page.style.setProperty('display', 'block', 'important');
      page.style.setProperty('width', 'min(1200px, calc(100% - 40px))', 'important');
      page.style.setProperty('max-width', '1200px', 'important');
      page.style.setProperty('margin', '20px auto', 'important');
      page.style.setProperty('background', '#f7f4ef', 'important');
      page.style.setProperty('border', '1px solid #1a1a1a', 'important');
      page.style.setProperty('box-shadow', '0 2px 12px rgba(0,0,0,0.15)', 'important');
      page.style.setProperty('font-family', "Georgia, 'Times New Roman', serif", 'important');
      page.style.setProperty('padding', '0', 'important');
      return true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', forceShopifyHeaderMatch, { once: true });
    } else {
      forceShopifyHeaderMatch();
    }
    var tries = 0;
    var timer = setInterval(function() {
      tries += 1;
      if (forceShopifyHeaderMatch() || tries > 20) clearInterval(timer);
    }, 300);
  }

  var STORAGE_KEY = 'jerry-chat-history';
  var SESSION_ID = 'jerry-session-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
  var apiUrl = isShopify
    ? 'https://rogerwilcoaviation.com/api/chat'
    : '/api/chat';

  var defaultHistory = [
    {
      role: 'assistant',
      content: 'Captain Jerry here. Avionics question, service inquiry, or just looking around — what can I do for you? — Capt. Jerry, RWAS'
    }
  ];

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultHistory.slice();
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return defaultHistory.slice();
      return parsed.filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      });
    } catch (e) {
      return defaultHistory.slice();
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {}
  }

  var history = loadHistory();
  var open = false;
  var loading = false;

  var css = '' +
    '.jerry-widget-bubble{position:fixed;right:16px;bottom:16px;z-index:999999;width:56px;height:56px;border-radius:50%;border:2px solid #d1b074;background:#1a1a1a;box-shadow:0 4px 16px rgba(0,0,0,.35);padding:0;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
    '.jerry-widget-bubble span{color:#d1b074;font-family:Arial,sans-serif;font-size:22px;font-weight:700;line-height:1}' +
    '.jerry-widget-backdrop{position:fixed;inset:0;z-index:999997;background:rgba(0,0,0,.32);display:none}' +
    '.jerry-widget-panel{position:fixed;right:0;bottom:0;z-index:999998;width:100%;max-width:400px;height:70vh;max-height:520px;background:#f7f4ef;border:2px solid #1a1a1a;box-shadow:0 14px 38px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}' +
    '.jerry-widget-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#1a1a1a;color:#f7f4ef;border-bottom:1px solid #3a3a3a}' +
    '.jerry-widget-title-wrap{display:flex;flex-direction:column;min-width:0}' +
    '.jerry-widget-title{font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d1b074}' +
    '.jerry-widget-sub{font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#f7f4ef}' +
    '.jerry-widget-close{border:1px solid rgba(247,244,239,.35);background:transparent;color:#f7f4ef;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1}' +
    '.jerry-widget-status{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 10px;border-bottom:1px dotted #bbb;background:#ede9e2}' +
    '.jerry-widget-dot{width:7px;height:7px;border-radius:50%;background:#2a7e2a}' +
    '.jerry-widget-status span{font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#555}' +
    '.jerry-widget-chat{flex:1;overflow-y:auto;padding:12px;background:#f1eee8}' +
    '.jerry-widget-row{margin-bottom:10px}' +
    '.jerry-widget-row.user{text-align:right}' +
    '.jerry-widget-row.assistant{text-align:left}' +
    '.jerry-widget-msg{display:inline-block;max-width:92%;padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:1.35;text-align:left;box-shadow:0 1px 3px rgba(0,0,0,.08);white-space:pre-wrap}' +
    '.jerry-widget-row.user .jerry-widget-msg{background:#1a1a1a;border:1px solid #1a1a1a;color:#f7f4ef}' +
    '.jerry-widget-row.assistant .jerry-widget-msg{background:#fffdf9;border:1px solid #1a1a1a;color:#1a1a1a}' +
    '.jerry-widget-error{margin:0 12px 10px;padding:10px 12px;border:1px solid #a33;background:#f7eaea;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#7a1f1f;display:none}' +
    '.jerry-widget-input{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid #c8c1b8;background:#ede9e2}' +
    '.jerry-widget-input input{flex:1;min-width:0;border:1px solid #1a1a1a;background:#fffdf9;padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#1a1a1a;outline:none}' +
    '.jerry-widget-input button{background:#1a1a1a;color:#f7f4ef;border:none;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;flex-shrink:0}' +
    '.jerry-widget-input button:disabled,.jerry-widget-input input:disabled{opacity:.5;cursor:default}' +
    '.jerry-thinking-msg{opacity:.6;font-style:italic;font-size:11px}' +
    '.jerry-thinking-dots span{animation:jerryDots 1.4s infinite;font-size:16px;font-weight:700;letter-spacing:2px}' +
    '.jerry-thinking-dots span:nth-child(2){animation-delay:.2s}' +
    '.jerry-thinking-dots span:nth-child(3){animation-delay:.4s}' +
    '@keyframes jerryDots{0%,80%,100%{opacity:.2}40%{opacity:1}}' +
'.jerry-widget-attach{background:none;border:none;font-size:18px;cursor:pointer;padding:4px 6px;opacity:.5;flex-shrink:0;line-height:1}' +
    '.jerry-widget-attach:hover{opacity:1}' +
        '@media (max-width:480px){.jerry-widget-panel{right:0;left:0;bottom:0;width:100%;max-width:100%;height:75vh}.jerry-widget-bubble{right:12px;bottom:12px;width:52px;height:52px}}';

  var style = document.createElement('style');
  style.setAttribute('data-jerry-widget', 'true');
  style.textContent = css;
  document.head.appendChild(style);

  var bubble = document.createElement('button');
  bubble.className = 'jerry-widget-bubble';
  bubble.setAttribute('type', 'button');
  bubble.setAttribute('aria-label', 'Chat with Captain Jerry');
  bubble.innerHTML = '<span>J</span>';

  var backdrop = document.createElement('div');
  backdrop.className = 'jerry-widget-backdrop';

  var panel = document.createElement('div');
  panel.className = 'jerry-widget-panel';
  panel.innerHTML = '' +
    '<div class="jerry-widget-header">' +
      '<div class="jerry-widget-title-wrap">' +
        '<div class="jerry-widget-title">CAPTAIN JERRY</div>' +
        '<div class="jerry-widget-sub">Avionics &amp; Service</div>' +
      '</div>' +
      '<button type="button" class="jerry-widget-close" aria-label="Close">&times;</button>' +
    '</div>' +
    '<div class="jerry-widget-status"><span class="jerry-widget-dot"></span><span>ONLINE — AVIONICS &amp; SERVICE</span></div>' +
    '<div class="jerry-widget-chat"></div>' +
    '<div class="jerry-widget-error"></div>' +
    '<div class="jerry-widget-input">' +
      '<button type="button" class="jerry-widget-attach" title="Attach photos or documents">📎</button>' +
      '<input type="file" class="jerry-file-input" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.tif,.tiff" style="display:none" />' +
      '<input type="text" class="jerry-widget-text-input" placeholder="Ask Jerry anything…" />' +
      '<button type="button" class="jerry-widget-send">Send</button>' +
    '</div>';

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  document.body.appendChild(bubble);

  var chat = panel.querySelector('.jerry-widget-chat');
  var errorBox = panel.querySelector('.jerry-widget-error');
  var input = panel.querySelector('.jerry-widget-text-input');
  var send = panel.querySelector('.jerry-widget-send');
  var closeBtn = panel.querySelector('.jerry-widget-close');

  function formatMessage(text) {
    // Strip INTAKE_COMPLETE, LISTING_DRAFT, LISTING_SAVE JSON blocks
    text = text.replace(/INTAKE_COMPLETE:\{[\s\S]*?\}\s*$/m, '');
    text = text.replace(/LISTING_DRAFT:\{[\s\S]*?\}\s*$/m, '');
    text = text.replace(/LISTING_SAVE:\{[\s\S]*?\}\s*$/m, '');
    text = text.trim();
    // Basic markdown: **bold**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    text = text.split('\n').join('<br>');
    return text;
  }

  function render() {
    chat.innerHTML = '';
    history.forEach(function (message) {
      var row = document.createElement('div');
      row.className = 'jerry-widget-row ' + message.role;
      var msg = document.createElement('div');
      msg.className = 'jerry-widget-msg';
      if (message.role === 'assistant') {
        msg.innerHTML = formatMessage(message.content);
      } else {
        msg.textContent = message.content;
      }
      row.appendChild(msg);
      chat.appendChild(row);
    });
    chat.scrollTop = chat.scrollHeight;
  }

  function setOpen(next) {
    open = !!next;
    panel.style.display = open ? 'flex' : 'none';
    bubble.style.display = open ? "none" : "flex";
    backdrop.style.display = open ? 'block' : 'none';
    if (open) {
      setTimeout(function () {
        input.focus();
        chat.scrollTop = chat.scrollHeight;
      }, 10);
    }
  }

  function removeThinkingIndicator() {
    var existing = chat.querySelector('#jerry-thinking');
    if (existing) existing.remove();
  }

  function showThinkingIndicator() {
    removeThinkingIndicator();
    var thinkRow = document.createElement('div');
    thinkRow.className = 'jerry-widget-row assistant';
    thinkRow.id = 'jerry-thinking';
    var thinkMsg = document.createElement('div');
    thinkMsg.className = 'jerry-widget-msg jerry-thinking-msg';
    thinkMsg.innerHTML = '<span class="jerry-thinking-dots"><span>.</span><span>.</span><span>.</span></span> Jerry is thinking';
    thinkRow.appendChild(thinkMsg);
    chat.appendChild(thinkRow);
    chat.scrollTop = chat.scrollHeight;
  }

  function setLoading(next) {
    loading = !!next;
    input.disabled = loading;
    send.disabled = loading;
    if (loading) {
      showThinkingIndicator();
    } else {
      removeThinkingIndicator();
    }
  }

  function normalizeSaleSession(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var token = raw.token || raw.session || raw.authToken || null;
    var email = raw.email || raw.userEmail || null;
    var name = raw.name || raw.userName || '';
    if (!token && !email) return null;
    return { token: token, email: email, name: name };
  }

  function getSaleSession() {
    try {
      var stored = normalizeSaleSession(JSON.parse(localStorage.getItem('rwas_sale_session') || 'null'));
      if (stored) return stored;
    } catch (e) {}
    return normalizeSaleSession(window.rwasSaleSession || null);
  }

  function getPendingListing() {
    try {
      return JSON.parse(localStorage.getItem('rwas_pending_listing') || 'null');
    } catch (e) {
      return null;
    }
  }

  function setPendingListing(data) {
    try {
      localStorage.setItem('rwas_pending_listing', JSON.stringify(data));
    } catch (e) {}
  }

  function clearPendingListing() {
    try {
      localStorage.removeItem('rwas_pending_listing');
    } catch (e) {}
  }

  function addAssistantMessage(text) {
    history.push({ role: 'assistant', content: text });
    saveHistory();
    render();
  }

  function hasListingIntent(text) {
    return /\b(list|sell|selling|for sale|list my aircraft|list my airplane|sell my aircraft|sell my airplane)\b/i.test(String(text || ''));
  }

  function wantsPendingSubmit(text) {
    return /^\s*(submit( my listing)?|file it|send it)\s*$/i.test(String(text || ''));
  }

  function extractTaggedJson(text, tag) {
    var re = new RegExp(tag + ':(\{[\s\S]*?\})');
    var match = String(text || '').match(re);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return { __parseError: true, __raw: match[1] };
    }
  }

  async function handleListingActions(replyText) {
    var messages = [];
    var session = getSaleSession();
    var listingDraft = extractTaggedJson(replyText, 'LISTING_DRAFT');
    var listingSave = extractTaggedJson(replyText, 'LISTING_SAVE');

    if (listingDraft) {
      if (listingDraft.__parseError) {
        messages.push('I had trouble reading the listing draft Jerry generated. Please try again.');
      } else if (!session || !session.token) {
        messages.push('Please sign in through Seller Login before I submit the listing for review.');
      } else {
        try {
          var createResponse = await fetch('https://sale-api.rogerwilcoaviation.com/listings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + session.token
            },
            body: JSON.stringify(listingDraft)
          });
          var createData = await createResponse.json().catch(function() { return {}; });
          if (!createResponse.ok) {
            if (createResponse.status === 401) {
              setPendingListing(listingDraft);
              messages.push('Almost there — you need to log in first. Click SELLER LOGIN above, verify your email, then say submit my listing and I will file it for you.');
            } else {
              messages.push(createData.error || ('Listing submission failed: ' + createResponse.status));
            }
          } else {
            clearPendingListing();
            messages.push('Your listing has been submitted for review! You can manage it from My Listings.');
          }
        } catch (e) {
          messages.push('Listing submission failed. Please try again in a moment.');
        }
      }
    }

    if (listingSave) {
      if (listingSave.__parseError) {
        messages.push('I had trouble reading the saved draft Jerry generated. Please try again.');
      } else if (!session || !session.email) {
        messages.push('Please sign in through Seller Login before I save your draft.');
      } else {
        try {
          listingSave.email = session.email;
          var draftResponse = await fetch('https://sale-api.rogerwilcoaviation.com/draft', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(listingSave)
          });
          var draftData = await draftResponse.json().catch(function() { return {}; });
          if (!draftResponse.ok) {
            messages.push(draftData.error || ('Draft save failed: ' + draftResponse.status));
          } else {
            messages.push('Draft saved. Come back anytime and say continue my listing.');
          }
        } catch (e) {
          messages.push('Draft save failed. Please try again in a moment.');
        }
      }
    }

    return messages;
  }

  async function submitMessage() {
    var text = input.value.trim();
    if (!text || loading) return;
    errorBox.style.display = 'none';
    errorBox.textContent = '';
    history.push({ role: 'user', content: text });
    saveHistory();
    render();
    input.value = '';

    var session = getSaleSession();
    var pendingListing = getPendingListing();

    if (wantsPendingSubmit(text) && pendingListing) {
      if (!session || !session.token) {
        addAssistantMessage('Almost there — you need to log in first. Click SELLER LOGIN above, verify your email, then say submit my listing and I will file it for you.');
        input.focus();
        return;
      }
      setLoading(true);
      await new Promise(function (resolve) {
        requestAnimationFrame(function () {
          requestAnimationFrame(resolve);
        });
      });
      try {
        var pendingResponse = await fetch('https://sale-api.rogerwilcoaviation.com/listings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.token
          },
          body: JSON.stringify(pendingListing)
        });
        var pendingData = await pendingResponse.json().catch(function() { return {}; });
        if (!pendingResponse.ok) {
          if (pendingResponse.status === 401) {
            addAssistantMessage('Almost there — you need to log in first. Click SELLER LOGIN above, verify your email, then say submit my listing and I will file it for you.');
          } else {
            addAssistantMessage(pendingData.error || ('Listing submission failed: ' + pendingResponse.status));
          }
        } else {
          clearPendingListing();
          addAssistantMessage('Your listing has been submitted for review! You can manage it from My Listings.');
        }
      } catch (err) {
        addAssistantMessage('Listing submission failed. Please try again in a moment.');
      } finally {
        setLoading(false);
        input.focus();
      }
      return;
    }

    if (hasListingIntent(text) && (!session || !session.token)) {
      addAssistantMessage('Before we get started, you need to log in. Click the SELLER LOGIN button above, verify your email, then come back and tell me you are ready.');
      input.focus();
      return;
    }

    setLoading(true);
    await new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });

    try {
      var apiMessages = history.map(function (m) { return { role: m.role, content: m.content }; });
      if (hasListingIntent(text) && session && session.email) {
        var lastIdx = apiMessages.length - 1;
        apiMessages[lastIdx] = {
          role: apiMessages[lastIdx].role,
          content: apiMessages[lastIdx].content + '\n\n' + '[System context: Seller is authenticated as ' + session.email + '. Login is confirmed — skip any login instructions and proceed directly to collecting the tail number.]'
        };
      }

      // FAA N-number lookup via our proxy
    var nnMatch = text.match(/\bN\s?-?\s?(\d{1,5}[A-Za-z]{0,2})\b/i);
    if (nnMatch) {
      try {
        var nClean = nnMatch[0].replace(/^[Nn]-?\s*/, '').toUpperCase();
        var faaRes = await fetch('https://sale-api.rogerwilcoaviation.com/faa-lookup?n=' + nClean);
        var faaData = await faaRes.json();
        if (faaData.found) {
          var faaParts = [];
          var aircraft = (faaData.year ? faaData.year + ' ' : '') + faaData.manufacturer + ' ' + faaData.model;
          if (aircraft.trim()) faaParts.push('Aircraft: ' + aircraft.trim());
          if (faaData.serial) faaParts.push('Serial: ' + faaData.serial);
          if (faaData.type) faaParts.push('Type: ' + faaData.type);
          if (faaData.engineMfr) faaParts.push('Engine: ' + faaData.engineMfr + (faaData.engineModel ? ' ' + faaData.engineModel : ''));
          if (faaData.status) faaParts.push('Status: ' + faaData.status);
          if (faaData.city && faaData.state) faaParts.push('Location: ' + faaData.city + ', ' + faaData.state);
          if (faaParts.length > 0) {
            history[history.length - 1].content += '\n[System: FAA Registry for N' + nClean + ':\n' + faaParts.join('\n') + '\nConfirm these details with the seller.]';
          }
        }
      } catch(e) { /* FAA lookup failed */ }
    }

    var response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!response.ok) {
        throw new Error('Chat request failed: ' + response.status);
      }

      var data = await response.json();
      var reply = data && (data.reply || data.message || data.content || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content));
      if (!reply) {
        throw new Error('No reply returned');
      }

      var rawReply = String(reply);
      var actionMessages = await handleListingActions(rawReply);
      var cleanReply = rawReply;
      cleanReply = cleanReply.replace(/INTAKE_COMPLETE:\{[\s\S]*?\}\s*$/m, '').trim();
      cleanReply = cleanReply.replace(/LISTING_DRAFT:\{[\s\S]*?\}\s*$/m, '').trim();
      cleanReply = cleanReply.replace(/LISTING_SAVE:\{[\s\S]*?\}\s*$/m, '').trim();
      if (actionMessages.length) {
        cleanReply = cleanReply ? (cleanReply + '\n\n' + actionMessages.join('\n')) : actionMessages.join('\n');
      }
      history.push({ role: 'assistant', content: cleanReply });
      saveHistory();
      render();
    } catch (err) {
      errorBox.textContent = 'Radio trouble. Try again in a moment.';
      errorBox.style.display = 'block';
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  bubble.addEventListener('click', function () { setOpen(true); });
  backdrop.addEventListener('click', function () { setOpen(false); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  send.addEventListener('click', submitMessage);

  // File upload handler
  var attachBtn = panel.querySelector('.jerry-widget-attach');
  var fileInput = panel.querySelector('.jerry-file-input');
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', async function() {
      var files = Array.from(fileInput.files || []);
      if (!files.length) return;
      fileInput.value = '';
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var isImg = file.type.startsWith('image/');
        var uid = 'up-' + Date.now() + '-' + i;
        var row = document.createElement('div');
        row.className = 'jerry-widget-row user';
        row.id = uid;
        var msg = document.createElement('div');
        msg.className = 'jerry-widget-msg';
        msg.style.fontSize = '12px';
        msg.innerHTML = (isImg ? '&#128247; ' : '&#128196; ') + '<strong>' + file.name + '</strong> <em style="font-size:10px;color:#888">uploading...</em>';
        row.appendChild(msg);
        chat.appendChild(row);
        chat.scrollTop = chat.scrollHeight;
        try {
          var url = 'https://sale-api.rogerwilcoaviation.com/chat-upload?filename=' + encodeURIComponent(file.name);
          var sess = JSON.parse(localStorage.getItem('rwas_sale_session') || 'null');
          var h = {};
          if (sess && sess.token) h['Authorization'] = 'Bearer ' + sess.token;
          var r = await fetch(url, { method: 'POST', headers: h, body: file });
          var d = await r.json();
          var el = document.getElementById(uid);
          if (el) {
            var m = el.querySelector('.jerry-widget-msg');
            if (d.ok) {
              var prev = isImg && d.url ? '<img src="' + d.url + '" style="max-width:180px;border:1px solid #ccc;margin:4px 0;display:block">' : '';
              m.innerHTML = prev + (isImg ? '&#128247; ' : '&#128196; ') + '<strong>' + file.name + '</strong> <span style="font-size:10px;color:#2d5016">&#10003; uploaded</span>';
              history.push({ role: 'user', content: '[Uploaded ' + (isImg ? 'photo' : 'document') + ': ' + file.name + ']' });
              saveHistory();
            } else {
              m.innerHTML = '&#9888; <strong>' + file.name + '</strong> <span style="font-size:10px;color:#8b0000">' + (d.error || 'failed') + '</span>';
            }
          }
        } catch(e) {
          var el = document.getElementById(uid);
          if (el) el.querySelector('.jerry-widget-msg').innerHTML = '&#9888; <strong>' + file.name + '</strong> <span style="font-size:10px;color:#8b0000">Network error</span>';
        }
      }
    });
  }
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitMessage();
  });

  render();
  setOpen(false);

  // Expose global open function for nav links
  window.openJerryChat = function() { setOpen(true); };
  window.jerryChat = function(msg) { setOpen(true); if(msg) { input.value = msg; setTimeout(submitMessage, 300); } };

  // Auto-intercept Ask Jerry links
  document.addEventListener("click", function(e) {
    var target = e.target;
    while (target && target !== document) {
      if (target.tagName === "A" && (target.textContent.trim() === "Ask Jerry" || target.getAttribute("href") === "#ask-jerry")) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        return;
      }
      target = target.parentElement;
    }
  }, true);
})();

// Runtime nav fix: ensure last nav tab says "About" not "Contact"
(function() {
  function fixNav() {
    var navs = document.querySelectorAll('.np-nav, nav');
    navs.forEach(function(nav) {
      var links = nav.querySelectorAll('a');
      links.forEach(function(a) {
        var text = a.textContent.trim();
        if (text === 'Contact' && a.href && a.href.indexOf('/contact') !== -1) {
          // Check if this is the last nav item (should be About)
          var nextSibling = a.nextElementSibling;
          if (!nextSibling || nextSibling.tagName !== 'A') {
            a.textContent = 'About';
            a.href = '/about';
          }
        }
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixNav);
  } else {
    fixNav();
  }
})();
