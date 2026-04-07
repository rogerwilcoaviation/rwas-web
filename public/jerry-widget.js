(function () {
  if (window.__jerryWidgetLoaded) return;
  window.__jerryWidgetLoaded = true;

  var STORAGE_KEY = 'jerry-chat-history';
  var isShopify = typeof window.Shopify !== 'undefined';
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
      '<input type="text" placeholder="Ask Jerry anything…" />' +
      '<button type="button">Send</button>' +
    '</div>';

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  document.body.appendChild(bubble);

  var chat = panel.querySelector('.jerry-widget-chat');
  var errorBox = panel.querySelector('.jerry-widget-error');
  var input = panel.querySelector('input');
  var send = panel.querySelector('.jerry-widget-input button');
  var closeBtn = panel.querySelector('.jerry-widget-close');

  function render() {
    chat.innerHTML = '';
    history.forEach(function (message) {
      var row = document.createElement('div');
      row.className = 'jerry-widget-row ' + message.role;
      var msg = document.createElement('div');
      msg.className = 'jerry-widget-msg';
      msg.textContent = message.content;
      row.appendChild(msg);
      chat.appendChild(row);
    });
    chat.scrollTop = chat.scrollHeight;
  }

  function setOpen(next) {
    open = !!next;
    panel.style.display = open ? 'flex' : 'none';
    backdrop.style.display = open ? 'block' : 'none';
    if (open) {
      setTimeout(function () {
        input.focus();
        chat.scrollTop = chat.scrollHeight;
      }, 10);
    }
  }

  function setLoading(next) {
    loading = !!next;
    input.disabled = loading;
    send.disabled = loading;
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
    setLoading(true);

    try {
      var response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(function (m) { return { role: m.role, content: m.content }; }) })
      });

      if (!response.ok) {
        throw new Error('Chat request failed: ' + response.status);
      }

      var data = await response.json();
      var reply = data && (data.reply || data.message || data.content || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content));
      if (!reply) {
        throw new Error('No reply returned');
      }

      history.push({ role: 'assistant', content: String(reply) });
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
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitMessage();
  });

  render();
  setOpen(false);
})();
