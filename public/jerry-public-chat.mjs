// Established public /api/chat only. No seller identity, storage, actions or tools.
export function mountJerryPublicChat({ panel, bubble, backdrop, renderMessage }) {
  const chat = panel.querySelector('.jerry-widget-chat');
  const input = panel.querySelector('.jerry-widget-text-input');
  const send = panel.querySelector('.jerry-widget-send');
  const error = panel.querySelector('.jerry-widget-error');
  const initial = 'Captain Jerry here. Ask about RWAS services, pricing and scheduling guidance, or how to reach the shop. Seller records and drafts stay in the secure seller panel.';
  let history = [{ role: 'assistant', content: initial }];
  let generation = 0;
  let pending;
  panel.querySelector('.jerry-widget-status').textContent = 'ONLINE — RWAS PUBLIC CHAT';
  panel.querySelector('.jerry-widget-input').hidden = false;
  panel.querySelector('.jerry-widget-input').style.display = '';
  panel.querySelector('.jerry-widget-attach').hidden = true;
  panel.querySelector('.jerry-service-open').hidden = true;
  panel.querySelector('.jerry-widget-privacy').textContent = 'Public RWAS information only. Do not enter passwords, payment details or private records. This conversation stays in this page; seller drafts require the secure seller panel.';
  input.maxLength = 2000;
  function open(value) {
    panel.style.display = value ? 'flex' : 'none';
    bubble.style.display = value ? 'none' : 'flex';
    backdrop.style.display = value ? 'block' : 'none';
    bubble.setAttribute('aria-expanded', String(value));
  }
  function render() {
    chat.replaceChildren();
    for (const message of history) {
      const row = document.createElement('div');
      row.className = 'jerry-widget-row ' + message.role;
      const text = document.createElement('div');
      text.className = 'jerry-widget-msg';
      if (message.role === 'assistant') renderMessage(text, message.content);
      else text.textContent = message.content;
      row.appendChild(text);
      chat.appendChild(row);
    }
    if (/^\/aircraft-for-sale(?:\/|$)/.test(location.pathname)) {
      const manual = document.createElement('button');
      manual.type = 'button';
      manual.textContent = 'Continue listing manually';
      manual.addEventListener('click', () => {
        open(false);
        document.dispatchEvent(new CustomEvent('rwas:open-manual-form'));
      });
      chat.appendChild(manual);
    }
    chat.scrollTop = chat.scrollHeight;
  }
  function busy(value) {
    send.disabled = input.disabled = value;
  }
  async function submit() {
    const text = input.value.trim();
    if (!text || pending || text.length > 2000) return;
    const current = generation;
    history.push({ role: 'user', content: text });
    history = history.slice(-8);
    input.value = '';
    error.textContent = '';
    error.style.display = 'none';
    render();
    busy(true);
    const controller = new AbortController();
    pending = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('https://rogerwilcoaviation.com/api/chat', {
        method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, state: null, listingUi: false }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (generation !== current) return;
      if (!response.ok || result.publicFaqOnly !== true || typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 14000)
        throw Error('Public chat is unavailable');
      // Ignore all action/state fields. Chat never mutates seller data.
      history.push({ role: 'assistant', content: result.reply });
      history = history.slice(-8);
      render();
    } catch {
      if (generation === current) {
        error.textContent = 'Chat is temporarily unavailable. Call (605) 299-8178 or email avionics@rwas.team. You can still use the secure seller panel.';
        error.style.display = 'block';
      }
    } finally {
      clearTimeout(timer);
      if (pending === controller) pending = null;
      if (generation === current) busy(false);
    }
  }
  bubble.onclick = () => open(true);
  backdrop.onclick = () => open(false);
  panel.querySelector('.jerry-widget-close').onclick = () => open(false);
  send.onclick = submit;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void submit(); }
  });
  window.openJerryChat = () => open(true);
  window.jerryChat = () => open(true); // Seller intent seeds never submit private data.
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a');
    if (link && (link.getAttribute('href') === '#ask-jerry' || link.textContent.trim() === 'Ask Jerry')) {
      event.preventDefault(); open(true);
    }
  });
  document.addEventListener('rwas:session-changed', () => {
    generation++;
    pending?.abort(); pending = null;
    history = [{ role: 'assistant', content: initial }];
    input.value = ''; error.textContent = ''; error.style.display = 'none'; busy(false); render();
  });
  render(); open(false);
  return true;
}
