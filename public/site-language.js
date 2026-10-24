/* Only published source IDs are translated. Form values and user content stay on the page. */
(() => {
  if (window.__rwasSiteLanguage) return;
  window.__rwasSiteLanguage = true;
  const supported = ['en', 'pt-BR', 'es'];
  const normalize = (text) =>
    String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  const routeLanguage = () =>
    /^\/pt-br(?:\/|$)/.test(location.pathname)
      ? 'pt-BR'
      : /^\/es(?:\/|$)/.test(location.pathname)
        ? 'es'
        : 'en';
  const preference = () => {
    try {
      const saved = localStorage.getItem('rwas-language');
      if (supported.includes(saved)) return saved;
    } catch {}
    return routeLanguage();
  };
  const skip =
    'script,style,noscript,pre,code,textarea,input,svg,[translate="no"],[data-site-language-control],.jerry-widget-msg,[data-private-content]';
  let language = preference(),
    dictionary = new Map(),
    templates = [],
    catalogPath = '',
    generation = 0,
    busy = false,
    again = false,
    timer,
    failed = false;
  const commonCatalogs = new Map();
  const texts = new Map(),
    attributes = new Map();
  let translations = {};
  try {
    translations = JSON.parse(
      localStorage.getItem('rwas-public-translations-v1') || '{}',
    );
  } catch {}
  const key = (id) => language + ':' + id;
  const status = (message) => {
    window.dispatchEvent(
      new CustomEvent('rwas:language-status', { detail: { status: message } }),
    );
    const label = document.querySelector(
      '[data-site-language-fallback-status]',
    );
    if (label && label.textContent !== message) label.textContent = message;
  };
  function save() {
    try {
      const entries = Object.entries(translations);
      localStorage.setItem(
        'rwas-public-translations-v1',
        JSON.stringify(Object.fromEntries(entries.slice(-2000))),
      );
    } catch {}
  }
  function choose(value) {
    try {
      localStorage.setItem('rwas-language', value);
    } catch {}
    window.dispatchEvent(
      new CustomEvent('rwas:language-changed', { detail: { language: value } }),
    );
  }
  function fallback() {
    if (
      document.querySelector(
        'meta[name="rwas-react-language"], [data-site-language-control]',
      )
    )
      return;
    const slot = document.createElement('div');
    slot.className = 'site-language-slot';
    slot.dataset.siteLanguageSlot = 'true';
    const control = document.createElement('div');
    control.className = 'lang-switcher';
    control.dataset.siteLanguageControl = 'true';
    control.translate = false;
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Language selection');
    for (const value of supported) {
      const button = document.createElement('button');
      button.type = 'button';
      button.lang = value;
      button.textContent =
        value === 'en' ? 'EN' : value === 'pt-BR' ? 'PT-BR' : 'ES';
      button.setAttribute(
        'aria-label',
        { en: 'English', 'pt-BR': 'Português do Brasil', es: 'Español' }[value],
      );
      button.setAttribute('aria-pressed', String(value === language));
      button.onclick = () => choose(value);
      nav.append(button);
    }
    const label = document.createElement('p');
    label.dataset.siteLanguageFallbackStatus = 'true';
    label.setAttribute('role', 'status');
    const retry = document.createElement('button');
    retry.textContent = 'Retry translation';
    retry.onclick = () =>
      window.dispatchEvent(new CustomEvent('rwas:language-retry'));
    retry.hidden = true;
    retry.dataset.siteLanguageRetry = 'true';
    control.append(nav, label, retry);
    slot.append(control);
    const anchor =
      document.querySelector('.bs-credentials') ||
      document.querySelector('.bs-masthead') ||
      document.querySelector('header');
    if (anchor) anchor.after(slot);
    else
      (
        document.querySelector('main') || document.body.firstElementChild
      )?.before(slot);
  }
  function match(raw) {
    const value = normalize(raw),
      entry = dictionary.get(value);
    if (entry) return { entry, values: [] };
    for (const template of templates) {
      const found = template.pattern.exec(value);
      if (found) return { entry: template.entry, values: found.slice(1) };
    }
    return null;
  }
  function value(record) {
    let translated =
      record.entry.language === language
        ? record.entry.text
        : translations[key(record.entry.id)];
    if (!translated) return record.raw;
    translated = translated.replace(
      /__RWAS_DYNAMIC(\d+)__/g,
      (_, index) => record.values[index] || '',
    );
    const spaces = /^(\s*)[\s\S]*?(\s*)$/.exec(record.raw);
    return spaces[1] + translated + spaces[2];
  }
  function collect() {
    const missing = new Map();
    const apply = (record, write) => {
      const next = value(record);
      if (record.rendered !== next) {
        write(next);
        record.rendered = next;
      }
      if (
        record.entry.language !== language &&
        !translations[key(record.entry.id)]
      )
        missing.set(record.entry.id, record.entry);
    };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || node.parentElement.closest(skip)) continue;
      let record = texts.get(node);
      if (!record || node.data !== record.rendered) {
        const found = match(node.data);
        if (!found) {
          texts.delete(node);
          continue;
        }
        record = { ...found, raw: node.data, rendered: node.data };
        texts.set(node, record);
      }
      apply(record, (next) => {
        node.data = next;
      });
    }
    for (const element of document.querySelectorAll(
      '[title],[alt],[aria-label],[placeholder]',
    )) {
      if (element.closest(skip) && !element.matches('input')) continue;
      if (
        element.closest(
          '[translate="no"],[data-private-content],[data-site-language-control]',
        )
      )
        continue;
      let records = attributes.get(element);
      if (!records) {
        records = new Map();
        attributes.set(element, records);
      }
      for (const name of ['title', 'alt', 'aria-label', 'placeholder']) {
        const raw = element.getAttribute(name);
        if (!raw) continue;
        let record = records.get(name);
        if (!record || raw !== record.rendered) {
          const found = match(raw);
          if (!found) {
            records.delete(name);
            continue;
          }
          record = { ...found, raw, rendered: raw };
          records.set(name, record);
        }
        apply(record, (next) => element.setAttribute(name, next));
      }
    }
    for (const element of texts.keys())
      if (!element.isConnected) texts.delete(element);
    for (const element of attributes.keys())
      if (!element.isConnected) attributes.delete(element);
    return [...missing.values()];
  }
  function restore() {
    for (const [node, record] of texts)
      if (node.isConnected && node.data === record.rendered) {
        node.data = record.raw;
        record.rendered = record.raw;
      }
    for (const [element, records] of attributes)
      if (element.isConnected)
        for (const [name, record] of records)
          if (element.getAttribute(name) === record.rendered) {
            element.setAttribute(name, record.raw);
            record.rendered = record.raw;
          }
  }
  async function catalog(path) {
    const response = await fetch(
      '/api/site-language/catalog?path=' + encodeURIComponent(path),
      { credentials: 'omit' },
    );
    if (!response.ok) throw Error('catalog');
    const data = await response.json();
    let common = [];
    if (data.commonPath) {
      if (
        !/^\/_site-language\/common\.[a-f0-9]{64}\.json$/.test(data.commonPath)
      )
        throw Error('catalog');
      if (!commonCatalogs.has(data.commonPath))
        commonCatalogs.set(
          data.commonPath,
          fetch(data.commonPath, { credentials: 'omit', cache: 'force-cache' })
            .then(async (response) => {
              if (!response.ok) throw Error('catalog');
              return response.json();
            })
            .catch((error) => {
              commonCatalogs.delete(data.commonPath);
              throw error;
            }),
        );
      const prepared = await commonCatalogs.get(data.commonPath);
      common = prepared.entries;
      for (const [target, values] of Object.entries(
        prepared.translations || {},
      ))
        for (const [id, text] of Object.entries(values))
          translations[target + ':' + id] = text;
    }
    dictionary = new Map(
      [...data.entries, ...common].map((entry) => [
        normalize(entry.text),
        entry,
      ]),
    );
    templates = [];
    for (const entry of dictionary.values())
      if (/__RWAS_DYNAMIC\d+__/.test(entry.text)) {
        const pattern = entry.text
          .split(/__RWAS_DYNAMIC\d+__/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('(.+?)');
        templates.push({ entry, pattern: new RegExp('^' + pattern + '$') });
      }
    catalogPath = path;
  }
  async function run() {
    if (failed) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    again = false;
    const revision = generation,
      target = language,
      path = location.pathname;
    try {
      if (language === 'en' && routeLanguage() === 'en') {
        restore();
        status('');
        return;
      }
      if (catalogPath !== path) await catalog(path);
      if (revision !== generation) return;
      let missing = collect();
      if (missing.length) status('Translating…');
      while (missing.length && revision === generation) {
        const batches = [];
        let batch = [],
          length = 0;
        for (const entry of missing.slice(0, 36)) {
          if (batch.length >= 12 || length + entry.text.length > 3500) {
            batches.push(batch);
            batch = [];
            length = 0;
          }
          batch.push(entry);
          length += entry.text.length;
        }
        if (batch.length) batches.push(batch);
        await Promise.all(
          batches.map(async (entries) => {
            const response = await fetch('/api/site-language', {
              method: 'POST',
              credentials: 'omit',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path,
                language: target,
                ids: entries.map((entry) => entry.id),
              }),
            });
            if (!response.ok) throw Error('translation');
            const data = await response.json();
            for (const [id, text] of Object.entries(data.translations || {}))
              if (typeof text === 'string')
                translations[target + ':' + id] = text;
          }),
        );
        save();
        if (revision !== generation) return;
        missing = collect();
      }
      if (revision === generation)
        status(
          language === 'en'
            ? ''
            : language === 'es'
              ? 'Traducción automática'
              : 'Tradução automática',
        );
    } catch {
      if (revision === generation) {
        failed = true;
        status(
          'Translation unavailable. Your selection is saved; retry to continue.',
        );
        const retry = document.querySelector('[data-site-language-retry]');
        if (retry) retry.hidden = false;
      }
    } finally {
      busy = false;
      if (again || revision !== generation) schedule();
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  }
  function changed() {
    generation++;
    status('');
    failed = false;
    language = preference();
    document.documentElement.lang = language;
    for (const wrapper of document.querySelectorAll('.ptbr-site'))
      wrapper.lang = language;
    fallback();
    for (const button of document.querySelectorAll(
      '[data-site-language-control] button[lang]',
    ))
      button.setAttribute('aria-pressed', String(button.lang === language));
    const retry = document.querySelector('[data-site-language-retry]');
    if (retry) retry.hidden = true;
    schedule();
  }
  window.addEventListener('rwas:language-changed', changed);
  window.addEventListener('rwas:language-route', changed);
  window.addEventListener('storage', (event) => {
    if (event.key === 'rwas-language') changed();
  });
  window.addEventListener('rwas:language-retry', () => {
    failed = false;
    schedule();
  });
  new MutationObserver((mutations) => {
    if (
      mutations.some(
        (mutation) =>
          !mutation.target.parentElement?.closest(
            '[data-site-language-control]',
          ) && !mutation.target.closest?.('[data-site-language-control]'),
      )
    )
      schedule();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'alt', 'aria-label', 'placeholder'],
  });
  changed();
})();
