// Account conversation UI. No transcript is cached for signed-in accounts.
// IDs and uncertain operation inputs are scoped to principal + surface + chat.
const text = (tag, value, cls) => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (cls) el.className = cls;
  return el;
};
const strings = {
  en: [
    'Saved conversations',
    'New conversation',
    'Delete conversation',
    'My saved work',
    'Resume saved draft',
    'Continue manually',
    'Send',
    'Ask Jerry…',
    'Retry this message',
    'Attach guest conversation',
    'Keep guest conversation separate',
    'Attach this tab’s guest conversation to your account? It will be saved for 90 days after the last message.',
    'Account conversations expire 90 days after the last message. Exchange conversations are available to authorized administrators for troubleshooting. Deleting chat preserves independently saved drafts, listings, uploads and support records.',
    'Guest chat stays in this tab. Sign in to save a conversation across devices.',
    'Delete this conversation? Saved drafts, listings, uploads and support records will remain.',
    'Conversation removed. Copy cleanup is pending; access is already blocked.',
    'Conversation deleted.',
    'Your session or page changed. Refresh account context before continuing.',
    'Refresh account context',
    'No conversation selected.',
    'Sign in to continue your saved listing.',
    'A message is awaiting a result. Retry it before sending another.',
    'Send as a new request',
    'The earlier reply cannot be recovered from the response service. Resending starts a new request.',
  ],
  es: [
    'Conversaciones guardadas',
    'Nueva conversación',
    'Eliminar conversación',
    'Mi trabajo guardado',
    'Retomar borrador',
    'Continuar manualmente',
    'Enviar',
    'Pregunte a Jerry…',
    'Reintentar mensaje',
    'Adjuntar conversación de visitante',
    'Mantenerla separada',
    '¿Adjuntar la conversación de esta pestaña a su cuenta? Se guardará durante 90 días desde el último mensaje.',
    'Las conversaciones caducan 90 días después del último mensaje. Los administradores autorizados pueden consultar las de Aviation Exchange para resolver problemas. Eliminar el chat conserva los borradores, anuncios, archivos y solicitudes de soporte guardados por separado.',
    'El chat de visitante permanece en esta pestaña. Inicie sesión para guardar conversaciones entre dispositivos.',
    '¿Eliminar esta conversación? Se conservarán los borradores, anuncios, archivos y solicitudes de soporte.',
    'Conversación retirada. La limpieza de copias está pendiente; el acceso ya está bloqueado.',
    'Conversación eliminada.',
    'Su sesión o página cambió. Actualice el contexto de la cuenta.',
    'Actualizar cuenta',
    'No hay conversación seleccionada.',
    'Inicie sesión para retomar su anuncio guardado.',
    'Hay un mensaje pendiente. Reinténtelo antes de enviar otro.',
    'Enviar como nueva solicitud',
    'La respuesta anterior no se conserva en el servicio. Reenviar inicia una nueva solicitud.',
  ],
  'pt-BR': [
    'Conversas salvas',
    'Nova conversa',
    'Excluir conversa',
    'Meu trabalho salvo',
    'Retomar rascunho',
    'Continuar manualmente',
    'Enviar',
    'Pergunte ao Jerry…',
    'Tentar mensagem novamente',
    'Anexar conversa de visitante',
    'Manter separada',
    'Anexar a conversa desta aba à sua conta? Ela será salva por 90 dias após a última mensagem.',
    'As conversas expiram 90 dias após a última mensagem. Administradores autorizados podem consultar as conversas do Aviation Exchange para solucionar problemas. Excluir o chat preserva rascunhos, anúncios, arquivos e registros de suporte salvos separadamente.',
    'O chat de visitante fica nesta aba. Entre para salvar conversas entre dispositivos.',
    'Excluir esta conversa? Rascunhos, anúncios, arquivos e registros de suporte serão preservados.',
    'Conversa removida. A limpeza das cópias está pendente; o acesso já está bloqueado.',
    'Conversa excluída.',
    'Sua sessão ou página mudou. Atualize o contexto da conta.',
    'Atualizar conta',
    'Nenhuma conversa selecionada.',
    'Entre para retomar seu anúncio salvo.',
    'Uma mensagem aguarda resposta. Tente novamente antes de enviar outra.',
    'Enviar como nova solicitação',
    'A resposta anterior não é mantida no serviço. Reenviar inicia uma nova solicitação.',
  ],
};
export async function mountJerryAccountChat({
  panel,
  bubble,
  backdrop,
  initialContext,
}) {
  let initial = initialContext;
  try {
    if (!initial) {
      const response = await fetch('/api/jerry/context', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 404) return false; // old server / rollback
      initial = await response.json();
      if (initial.enabled === false) return false;
      if (!response.ok || initial.error)
        throw Error(initial.error || 'Jerry account service is unavailable.');
    }
  } catch (error) {
    initial = { error: error.message };
  }
  const style = text(
    'style',
    '.jerry-account-chat [hidden]{display:none!important}.jerry-account-chat{font-family:Arial,Helvetica,sans-serif;height:85vh;max-height:720px}.jerry-account-tools{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#ede9e2;border-bottom:1px solid #c8c1b8}.jerry-account-tools select{width:100%;min-width:0;padding:7px}.jerry-account-tools button,.jerry-consent button,.jerry-retry{padding:7px 9px;border:1px solid #8a8175;background:#fffdf9;color:#222;font:12px Arial,sans-serif;cursor:pointer}.jerry-consent{padding:10px 12px;background:#fff8e6;font:12px/1.4 Arial,sans-serif}.jerry-consent button{margin:4px}.jerry-account-note{padding:8px 12px;margin:0;font:11px/1.4 Arial,sans-serif}.jerry-account-chat .jerry-widget-input{margin:0}.jerry-account-chat .jerry-widget-chat{min-height:80px}.jerry-account-chat .jerry-widget-msg{overflow-wrap:anywhere}.jerry-account-chat button:disabled{opacity:.5;cursor:default}',
  );
  document.head.append(style);
  panel.classList.add('jerry-account-chat');
  panel.replaceChildren();
  const header = text('div', '', 'jerry-widget-header');
  header.append(text('strong', 'CAPTAIN JERRY'));
  const close = text('button', '×', 'jerry-widget-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  header.append(close);
  const tools = text('div', '', 'jerry-account-tools'),
    select = document.createElement('select');
  const newButton = text('button', ''),
    deleteButton = text('button', ''),
    statusButton = text('button', ''),
    resumeButton = text('button', ''),
    manual = text('button', '');
  const consent = text('div', '', 'jerry-consent'),
    consentText = text('p', ''),
    attach = text('button', ''),
    separate = text('button', '');
  consent.append(consentText, attach, separate);
  tools.append(
    select,
    newButton,
    deleteButton,
    statusButton,
    resumeButton,
    manual,
  );
  const chat = text('div', '', 'jerry-widget-chat');
  chat.setAttribute('aria-live', 'polite');
  const errorBox = text('div', '', 'jerry-widget-error');
  errorBox.setAttribute('role', 'alert');
  const refreshButton = text('button', '', 'jerry-retry'),
    note = text('p', '', 'jerry-account-note');
  const form = document.createElement('form');
  form.className = 'jerry-widget-input';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 2000;
  input.autocomplete = 'off';
  const send = text('button', '');
  send.type = 'submit';
  form.append(input, send);
  panel.append(
    header,
    tools,
    consent,
    chat,
    errorBox,
    refreshButton,
    note,
    form,
  );
  for (const node of [
    header,
    tools,
    consent,
    chat,
    errorBox,
    refreshButton,
    note,
    form,
  ])
    node.setAttribute('translate', 'no');
  const privacy = text('a', 'Privacy and retention');
  privacy.href = '/privacy';
  privacy.target = '_blank';
  privacy.rel = 'noopener noreferrer';
  note.append(' ', privacy);
  const serviceButton = text('button', 'Service request form', 'jerry-retry');
  panel.insertBefore(serviceButton, chat);
  let serviceUi = null,
    serviceLoad = null;
  serviceButton.onclick = () => {
    if (serviceUi) {
      serviceUi.open();
      return;
    }
    if (serviceLoad) return;
    serviceButton.disabled = true;
    serviceLoad = document.createElement('script');
    serviceLoad.src = '/intake-service.js';
    serviceLoad.onload = () => {
      serviceButton.disabled = false;
      if (typeof window.createRwasServiceIntake === 'function') {
        serviceUi = window.createRwasServiceIntake(panel, serviceButton);
        serviceUi.open();
      } else {
        serviceLoad = null;
        fail('Service form unavailable. Nothing has been sent.');
      }
    };
    serviceLoad.onerror = () => {
      serviceLoad.remove();
      serviceLoad = null;
      serviceButton.disabled = false;
      fail('Service form unavailable. Nothing has been sent.');
    };
    document.head.append(serviceLoad);
  };
  const resumeJerry = text('button', 'Resume with Jerry');
  tools.append(resumeJerry);
  let context = null,
    active = null,
    pending = null,
    items = [],
    turns = [],
    busy = false,
    generation = 0,
    controller = null,
    listingActive = false,
    open = false;
  let language = locale(),
    path = location.pathname.replace(/\/$/, '') || '/',
    surface = scope(path);
  const channel =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('rwas-jerry-v1')
      : null;
  function locale() {
    try {
      const value = localStorage.getItem('rwas-language');
      return strings[value] ? value : 'en';
    } catch {
      return 'en';
    }
  }
  function scope(p) {
    return /^\/aircraft-for-sale(?:\/|$)/.test(p) ||
      ['/seller-review', '/seller-accounts'].includes(p)
      ? 'exchange'
      : 'public';
  }
  const s = (index) => strings[language][index];
  function get(key, fallback) {
    try {
      return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function put(key, value) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
  function key(kind) {
    return (
      'rwas-jerry-v1:' +
      (context?.identity?.owner || 'guest') +
      ':' +
      surface +
      ':' +
      kind
    );
  }
  let guests = get('rwas-jerry-v1:guest:' + surface + ':history', []);
  let guestPending = null;
  const terminalAttempts = new Set([
    'JERRY_ATTEMPT_COMPLETED',
    'JERRY_ATTEMPT_FAILED',
    'JERRY_ATTEMPT_UNCERTAIN',
    'JERRY_ATTEMPT_EXPIRED',
    'JERRY_REPLAY_CONFLICT',
  ]);
  function recovery() {
    return context?.identity ? pending : guestPending;
  }
  function fail(error) {
    errorBox.textContent = typeof error === 'string' ? error : error.message;
    errorBox.style.display = 'block';
  }
  function invalidate() {
    generation++;
    controller?.abort();
    controller = null;
    busy = false;
    send.disabled = false;
    input.disabled = false;
  }
  function token() {
    return {
      generation,
      owner: context?.identity?.owner || '',
      session: context?.identity?.sessionRef || '',
      id: active?.id || '',
      path,
      language,
    };
  }
  function valid(t) {
    const now = token();
    return (
      Object.keys(t).every((k) => t[k] === now[k]) &&
      path === (location.pathname.replace(/\/$/, '') || '/')
    );
  }
  function openPanel(value) {
    open = value;
    bubble.style.display = open ? 'none' : 'flex';
    panel.style.display = open ? 'flex' : 'none';
    backdrop.style.display = open ? 'block' : 'none';
    if (open) input.focus();
  }
  function labels() {
    select.setAttribute('aria-label', s(0));
    newButton.textContent = s(1);
    deleteButton.textContent = s(2);
    statusButton.textContent = s(3);
    resumeButton.textContent = s(4);
    manual.textContent = s(5);
    send.textContent = s(6);
    input.placeholder = s(7);
    input.setAttribute('aria-label', s(7));
    attach.textContent = s(9);
    separate.textContent = s(10);
    consentText.textContent = s(11);
    note.replaceChildren(
      document.createTextNode((context?.identity ? s(12) : s(13)) + ' '),
      privacy,
    );
    refreshButton.textContent = s(18);
    refreshButton.hidden =
      !!context && !context.error && errorBox.style.display !== 'block';
    privacy.textContent =
      language === 'es'
        ? 'Privacidad y conservación'
        : language === 'pt-BR'
          ? 'Privacidade e retenção'
          : 'Privacy and retention';
    serviceButton.textContent =
      language === 'es'
        ? 'Formulario de servicio'
        : language === 'pt-BR'
          ? 'Formulário de serviço'
          : 'Service request form';
    tools.hidden = !context?.identity;
    statusButton.hidden =
      resumeButton.hidden =
      manual.hidden =
        surface !== 'exchange';
    resumeJerry.textContent =
      language === 'es'
        ? 'Retomar con Jerry'
        : language === 'pt-BR'
          ? 'Retomar com Jerry'
          : 'Resume with Jerry';
    resumeJerry.hidden =
      surface !== 'exchange' ||
      context?.identity?.role !== 'seller' ||
      !turns.some((t) => t.result?.action?.type === 'resume_saved_draft');
    manual.hidden ||= context?.identity?.role !== 'seller';
    resumeButton.hidden ||= context?.identity?.role !== 'seller';
    consent.hidden =
      !context?.identity ||
      !guests.length ||
      get(key('guest-consent-dismissed'), false);
  }
  function render() {
    labels();
    chat.replaceChildren();
    const messages = context?.identity
      ? turns.flatMap((t) =>
          t.status === 'imported'
            ? [t.message]
            : [
                { role: 'user', content: t.input.message },
                ...(t.result?.reply
                  ? [
                      {
                        role: 'assistant',
                        content:
                          t.result.reply +
                          (t.result.notice ? '\n\n' + t.result.notice : ''),
                      },
                    ]
                  : []),
              ],
        )
      : guests;
    for (const message of messages) {
      const row = text('div', '', 'jerry-widget-row ' + message.role);
      row.append(text('div', message.content, 'jerry-widget-msg'));
      chat.append(row);
    }
    const waiting = recovery();
    if (waiting) {
      if (!context?.identity) {
        const row = text('div', '', 'jerry-widget-row user');
        row.append(text('div', waiting.input.message, 'jerry-widget-msg'));
        chat.append(row);
      }
      if (waiting.needsNew) chat.append(text('p', s(23), 'jerry-account-note'));
      const retry = text('button', s(waiting.needsNew ? 22 : 8), 'jerry-retry');
      retry.onclick = () => void submit('', null, true);
      chat.append(retry);
      if (waiting.input.page !== path) {
        retry.disabled = true;
        const back = text('a', 'Return to the message’s original page');
        back.href = waiting.input.page;
        chat.append(back);
      }
    }
    const placeholder = text('option', s(0));
    placeholder.value = '';
    select.replaceChildren(
      placeholder,
      ...items.map((c) => {
        const option = text('option', c.title);
        option.value = c.id;
        return option;
      }),
    );
    select.value = active?.id || '';
    deleteButton.disabled = !active || busy;
    chat.scrollTop = chat.scrollHeight;
  }
  async function api(operation, body, signal) {
    let auth = {};
    if (
      operation === 'message' &&
      body?.input?.mode === 'listing' &&
      typeof window.rwasSellerRequestHeaders === 'function'
    )
      auth = await window.rwasSellerRequestHeaders('/api/aircraft-sale/intake');
    const response = await fetch('/api/jerry/website', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: {
        ...auth,
        'Content-Type': 'application/json',
        'X-RWAS-Jerry': 'website-v1',
      },
      body: JSON.stringify({
        operation,
        expected: context?.identity
          ? {
              owner: context.identity.owner,
              sessionRef: context.identity.sessionRef,
            }
          : undefined,
        surface,
        page: path,
        body,
      }),
    });
    // Do not render streaming/partial/error content from another protocol.
    if (
      !(response.headers.get('Content-Type') || '').includes('application/json')
    )
      throw Error('Jerry returned an unexpected response.');
    const result = await response.json();
    if (!response.ok || result.error)
      throw Object.assign(Error(result.error || 'Jerry request failed.'), {
        status: response.status,
        code: result.code,
      });
    return result;
  }
  async function list() {
    const t = token();
    try {
      const result = await api('list', {});
      if (!valid(t)) return;
      items = result.conversations;
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (
          k?.startsWith(key('pending:')) &&
          !items.some((c) => k === key('pending:' + c.id))
        )
          put(k, null);
      }
      render();
    } catch (error) {
      if (valid(t)) fail(error);
    }
  }
  async function read(id) {
    invalidate();
    active = { id };
    pending = null;
    turns = [];
    render();
    const t = token();
    try {
      const result = await api('read', { id });
      if (!valid(t)) return;
      active = result.conversation;
      items = items.map((item) =>
        item.id === active.id
          ? {
              ...item,
              title: active.title,
              updatedAt: active.updatedAt,
              expiresAt: active.expiresAt,
            }
          : item,
      );
      turns = result.turns;
      pending =
        turns
          .filter((turn) => ['pending', 'failed'].includes(turn.status))
          .at(-1) || get(key('pending:' + id), null);
      if (
        pending &&
        turns.some(
          (turn) => turn.id === pending.id && turn.status === 'completed',
        )
      ) {
        pending = null;
        put(key('pending:' + id), null);
      }
      const latest = turns
        .filter((turn) => turn.status === 'completed')
        .at(-1)?.result;
      listingActive =
        !!latest?.state && !latest.state.completed && !latest.state.cancelled;
      if (latest?.draftStamp) context.draftStamp = latest.draftStamp;
      put(key('active'), id);
      render();
    } catch (error) {
      if (valid(t)) {
        if (error.status === 410) put(key('pending:' + id), null);
        if (error.status === 410)
          items = items.filter((item) => item.id !== id);
        active = null;
        pending = null;
        turns = [];
        put(key('active'), null);
        render();
        fail(error);
      }
    }
  }
  async function create() {
    invalidate();
    active = null;
    turns = [];
    pending = null;
    listingActive = false;
    render();
    const t = token();
    try {
      const result = await api('create', { id: crypto.randomUUID() });
      if (!valid(t)) return null;
      active = result.conversation;
      put(key('active'), active.id);
      const created = token();
      await list();
      if (!valid(created)) return null;
      render();
      return active;
    } catch (error) {
      if (valid(t)) fail(error);
      return null;
    }
  }
  async function refresh() {
    const previousOwner = context?.identity?.owner;
    invalidate();
    const g = generation;
    input.value = '';
    context = null;
    active = null;
    pending = null;
    turns = [];
    items = [];
    guestPending = null;
    listingActive = false;
    render();
    try {
      const response = await fetch('/api/jerry/context', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json();
      if (g !== generation) return;
      if (!response.ok || !result.enabled || result.error)
        throw Error(result.error || 'Account conversations are unavailable.');
      context = result;
      if (previousOwner && previousOwner !== context.identity?.owner) {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (
            k?.startsWith('rwas-jerry-v1:' + previousOwner + ':') &&
            k.includes(':pending:')
          )
            put(k, null);
        }
      }
      errorBox.style.display = 'none';
      guests = get('rwas-jerry-v1:guest:' + surface + ':history', []);
      guestPending = get('rwas-jerry-v1:guest:' + surface + ':pending', null);
      if (guestPending && guestPending.issuedAt + 86400000 <= Date.now())
        guestPending.needsNew = true;
      render();
      if (context.identity) {
        await list();
        if (g !== generation) return;
        const id = get(key('active'), null);
        if (id && items.some((c) => c.id === id)) await read(id);
      }
    } catch (error) {
      if (g === generation) {
        context = { error: error.message };
        render();
        fail(error);
      }
    }
  }
  async function submit(message, forcedMode, retry = false) {
    if (busy) return;
    if (context?.error || !context) {
      fail(s(17));
      return;
    }
    const waiting = recovery();
    if (retry && !waiting) return;
    if (waiting && !retry) {
      fail(s(21));
      return;
    }
    const value = (
      retry ? waiting?.input.message : message || input.value || ''
    ).trim();
    if (!retry && !value) return;
    const listingIntent =
      surface === 'exchange' &&
      /(?:create a listing|list my aircraft|resume my saved listing)/i.test(
        value,
      );
    if (listingIntent && !context.identity) {
      document.dispatchEvent(new CustomEvent('rwas:open-seller-login'));
      fail(s(20));
      return;
    }
    if (context.identity && !active) {
      if (!(await create())) return;
    }
    if (listingIntent) {
      const before = token();
      try {
        const response = await fetch('/api/jerry/context', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const fresh = await response.json();
        if (!valid(before)) return;
        if (
          !response.ok ||
          fresh.identity?.owner !== context.identity?.owner ||
          fresh.identity?.sessionRef !== context.identity?.sessionRef
        )
          throw Error(s(17));
        context.draftStamp = fresh.draftStamp;
      } catch (error) {
        if (valid(before)) fail(error);
        return;
      }
    }
    const mode =
      forcedMode || (listingIntent || listingActive ? 'listing' : 'chat');
    const request =
      retry && context.identity && !waiting.needsNew
        ? {
            id: active.id,
            generation: active.generation,
            turnId: pending.id,
            input: pending.input,
          }
        : {
            id: active?.id,
            generation: active?.generation,
            turnId: crypto.randomUUID(),
            input: {
              message: value,
              mode,
              locale: language,
              page: path,
              ...(mode === 'listing'
                ? {
                    resume: /resume my saved listing/i.test(value),
                    draftStamp: context.draftStamp,
                  }
                : {}),
            },
          };
    const t = token();
    busy = true;
    send.disabled = true;
    controller = new AbortController();
    const signal = controller.signal;
    errorBox.style.display = 'none';
    if (!retry) input.value = '';
    let guestRequest;
    if (context.identity) {
      pending = {
        id: request.turnId,
        input: request.input,
        createdAt: Date.now(),
      };
      put(key('pending:' + active.id), pending);
    } else {
      guestRequest =
        retry && !waiting.needsNew
          ? waiting
          : {
              operationId: crypto.randomUUID(),
              issuedAt: Date.now(),
              input: {
                message: value,
                mode: 'chat',
                locale: language,
                page: path,
              },
              history: retry
                ? waiting.history
                : guests.slice(-6).map((m) => ({
                    role: m.role,
                    content: m.content.slice(0, 4000),
                  })),
            };
      guestPending = guestRequest;
      put(key('pending'), guestPending);
      render();
    }
    try {
      const result = await api(
        'message',
        context.identity
          ? request
          : {
              operationId: guestRequest.operationId,
              issuedAt: guestRequest.issuedAt,
              input: {
                message: guestRequest.input.message,
                mode: 'chat',
                locale: guestRequest.input.locale,
              },
              history: guestRequest.history,
            },
        signal,
      );
      if (!valid(t)) return;
      if (context.identity) {
        put(key('pending:' + active.id), null);
        pending = null;
        if (result.result?.draftStamp)
          context.draftStamp = result.result.draftStamp;
        listingActive =
          !!result.result?.state &&
          !result.result.state.completed &&
          !result.result.state.cancelled;
        await read(active.id);
      } else {
        guestPending = null;
        put(key('pending'), null);
        guests.push(
          { role: 'user', content: value },
          {
            role: 'assistant',
            content:
              result.result.reply +
              (result.result.notice ? '\n\n' + result.result.notice : ''),
          },
        );
        guests = guests.slice(-40);
        put(key('history'), guests);
        render();
      }
    } catch (error) {
      if (valid(t)) {
        if (terminalAttempts.has(error.code)) {
          const current = recovery();
          if (current && (!context.identity || current.input.mode === 'chat')) {
            current.needsNew = true;
            put(
              context.identity ? key('pending:' + active.id) : key('pending'),
              current,
            );
          }
        }
        if (error.status === 410) {
          put(key('pending:' + active.id), null);
          pending = null;
        }
        if (error.status === 401 || error.code === 'JERRY_SESSION_CHANGED') {
          invalidate();
          context = null;
          active = null;
          pending = null;
          turns = [];
          render();
        }
        fail(error);
        render();
      }
    } finally {
      if (valid(t)) {
        busy = false;
        send.disabled = false;
        controller = null;
        render();
      }
    }
  }
  async function remove() {
    if (!active || !confirm(s(14))) return;
    const id = active.id,
      body = { id, generation: active.generation };
    invalidate();
    const t = token();
    try {
      const result = await api('delete', body);
      if (!valid(t)) return;
      put(key('pending:' + id), null);
      put(key('active'), null);
      active = null;
      pending = null;
      turns = [];
      listingActive = false;
      items = items.filter((item) => item.id !== id);
      render();
      channel?.postMessage({ owner: context.identity.owner, surface, id });
      window.dispatchEvent(
        new CustomEvent('rwas:jerry-deleted', { detail: { id } }),
      );
      const cleared = token();
      await list();
      if (!valid(cleared)) return;
      render();
      fail(s(result.pending ? 15 : 16));
    } catch (error) {
      if (valid(t)) fail(error);
    }
  }
  channel?.addEventListener('message', (event) => {
    const data = event.data;
    if (context?.identity?.owner !== data.owner || surface !== data.surface)
      return;
    items = items.filter((item) => item.id !== data.id);
    render();
    put(key('pending:' + data.id), null);
    if (active?.id === data.id) {
      invalidate();
      active = null;
      pending = null;
      turns = [];
      put(key('active'), null);
      render();
      void list().catch(fail);
    }
  });
  async function attachGuests() {
    if (!context?.identity || !guests.length) return;
    let captured;
    try {
      if (!(await create())) return;
      const t = token();
      captured = t;
      await api('import', {
        id: active.id,
        generation: active.generation,
        operationId: crypto.randomUUID(),
        consent: true,
        messages: guests,
      });
      if (!valid(t)) return;
      put('rwas-jerry-v1:guest:' + surface + ':history', null);
      guests = [];
      await read(active.id);
      await list();
    } catch (error) {
      if (captured && valid(captured)) fail(error);
    }
  }
  select.onchange = () => {
    if (select.value) void read(select.value);
  };
  newButton.onclick = () => void create().catch(fail);
  deleteButton.onclick = () => void remove();
  resumeJerry.onclick = () =>
    void submit('I want to resume my saved listing.', 'listing');
  statusButton.onclick = () => void submit(s(3), 'status');
  resumeButton.onclick = () => void submit(s(4), 'resume');
  manual.onclick = () => {
    if (context?.identity?.role === 'seller') {
      document.dispatchEvent(new CustomEvent('rwas:open-manual-form'));
      openPanel(false);
    }
  };
  attach.onclick = () => void attachGuests();
  separate.onclick = () => {
    put(key('guest-consent-dismissed'), true);
    render();
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    void submit();
  };
  refreshButton.onclick = () => void refresh();
  bubble.onclick = () => openPanel(!open);
  close.onclick = backdrop.onclick = () => openPanel(false);
  window.openJerryChat = () => openPanel(true);
  window.jerryChat = (message) => {
    openPanel(true);
    if (message) void submit(message);
  };
  document.addEventListener('rwas:session-changed', () => {
    void refresh();
  });
  window.addEventListener('rwas:language-changed', () => {
    language = locale();
    invalidate();
    render();
    if (context?.identity && active) void read(active.id);
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href="#ask-jerry"]');
    if (link) {
      event.preventDefault();
      openPanel(true);
    }
  });
  // Next navigation can retain this widget. Fence responses at every transition.
  setInterval(() => {
    if (context?.identity?.expiresAt <= Date.now()) {
      void refresh();
      return;
    }
    if (active?.expiresAt <= Date.now()) {
      put(key('pending:' + active.id), null);
      put(key('active'), null);
      invalidate();
      active = null;
      pending = null;
      turns = [];
      render();
      void refresh();
    }
    const p = location.pathname.replace(/\/$/, '') || '/';
    if (p !== path) {
      invalidate();
      path = p;
      surface = scope(path);
      turns = [];
      active = null;
      pending = null;
      context = null;
      render();
      void refresh();
    }
  }, 250);
  context = initial;
  render();
  openPanel(false);
  if (initial.error) fail(initial.error);
  else await refresh();
  return true;
}
