// Portfolio — rendu côté client à partir des fichiers content/<langue>/*.json.
// Aucune dépendance, aucune étape de build.

(function () {
  'use strict';

  const DEFAULT_LANG = 'fr';
  const params = new URLSearchParams(location.search);

  // ---------- Utilitaires ----------

  const isTodo = (s) => typeof s === 'string' && s.includes('TODO');

  // Crée un élément DOM. Le texte passe par textContent : pas d'injection HTML.
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // Texte simple, mis en évidence s'il s'agit d'un TODO.
  function text(s, tag = 'span') {
    return el(tag, { class: isTodo(s) ? 'todo' : null }, s);
  }

  // Lien externe ; si l'URL est un TODO, affiche un marqueur à la place.
  function link(label, url) {
    if (!url || isTodo(url)) return el('span', { class: 'todo' }, `${label} (TODO)`);
    const external = /^https?:/.test(url);
    return el('a', { href: url, target: external ? '_blank' : null, rel: external ? 'noopener' : null }, label);
  }

  // Image avec repli : si le fichier est absent, affiche un cadre nommé.
  function image(src, alt, missingLabel, cls = 'media') {
    const box = el('div', { class: cls });
    if (!src) {
      box.append(placeholder('', missingLabel));
      return box;
    }
    const img = el('img', { src, alt: alt || '', loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(placeholder(src, missingLabel)));
    box.append(img);
    return box;
  }

  function placeholder(src, missingLabel) {
    return el('div', { class: 'placeholder' },
      el('span', { class: 'placeholder-title' }, missingLabel),
      src ? el('code', {}, src) : null);
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} : HTTP ${res.status}`);
    return res.json();
  }

  // ---------- Langue ----------

  async function resolveLang() {
    let langs = [DEFAULT_LANG];
    try { langs = await loadJSON('content/languages.json'); } catch (e) { /* fichier optionnel */ }
    const wanted = params.get('lang');
    return { lang: langs.includes(wanted) ? wanted : DEFAULT_LANG, langs };
  }

  // Conserve la langue courante dans les liens internes.
  function withLang(href, lang) {
    if (lang === DEFAULT_LANG) return href;
    const [path, hash] = href.split('#');
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}lang=${lang}${hash ? '#' + hash : ''}`;
  }

  function renderLangSwitch(lang, langs) {
    const box = document.getElementById('lang-switch');
    if (!box || langs.length < 2) return;
    for (const l of langs) {
      const p = new URLSearchParams(location.search);
      if (l === DEFAULT_LANG) p.delete('lang'); else p.set('lang', l);
      const q = p.toString();
      box.append(el('a', { href: location.pathname + (q ? '?' + q : ''), class: l === lang ? 'active' : null }, l.toUpperCase()));
    }
  }

  // ---------- Thème ----------

  function setupTheme(ui) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.setAttribute('aria-label', ui.theme_toggle || 'Theme');
    btn.title = ui.theme_toggle || '';
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.dataset.theme ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // ---------- Remplissage générique ----------

  function fillStatic(site) {
    document.querySelectorAll('[data-site]').forEach((n) => {
      const v = site[n.dataset.site];
      if (v == null) return;
      n.textContent = v;
      if (isTodo(v)) n.classList.add('todo');
    });
    document.querySelectorAll('[data-ui]').forEach((n) => {
      const v = site.ui[n.dataset.ui];
      if (v != null) n.textContent = v;
    });
  }

  function linkList(target, links) {
    if (!target) return;
    for (const l of links) target.append(el('li', {}, link(l.label, l.url)));
  }

  function tags(list) {
    return el('ul', { class: 'tags' }, (list || []).map((t) => el('li', {}, t)));
  }

  // ---------- Page d'accueil ----------

  function renderHome(site, projects, lang) {
    const ui = site.ui;
    linkList(document.getElementById('hero-links'), site.links);
    linkList(document.getElementById('contact-links'), site.links);

    const grid = document.getElementById('project-grid');
    for (const p of projects) {
      const href = withLang(`project.html?p=${encodeURIComponent(p.slug)}`, lang);
      grid.append(el('article', { class: 'card' },
        el('a', { href, class: 'card-link', 'aria-label': p.title },
          image(p.cover, p.title, ui.missing_image, 'media card-media'),
          el('div', { class: 'card-body' },
            el('h3', {}, p.title),
            el('p', { class: 'pitch' }, p.pitch),
            p.highlight ? el('p', { class: 'metric' },
              el('strong', {}, p.highlight.value), ' ', el('span', {}, p.highlight.label)) : null,
            tags(p.tags.slice(0, 4)),
            text(p.team, 'p')
          ))));
    }

    const exp = document.getElementById('experience-list');
    for (const x of site.experience || []) {
      exp.append(el('article', { class: 'exp' },
        el('div', { class: 'exp-head' },
          el('h3', {}, x.company),
          el('span', { class: 'meta' }, x.period)),
        text(x.title, 'p'),
        el('ul', {}, x.items.map((i) => text(i, 'li'))),
        tags(x.tags)));
    }

    const other = document.getElementById('other-list');
    for (const o of site.otherProjects || []) {
      other.append(el('li', {},
        el('div', { class: 'exp-head' },
          o.url ? link(o.title, o.url) : el('strong', {}, o.title),
          o.url ? null : el('span', { class: 'meta' }, ui.private_repo)),
        el('p', {}, o.desc),
        tags(o.tags)));
    }
  }

  // ---------- Page projet ----------

  function renderProject(site, projects, lang) {
    const ui = site.ui;
    const root = document.getElementById('project');
    const p = projects.find((x) => x.slug === params.get('p'));
    const back = el('a', { href: withLang('./#projets', lang), class: 'back' }, ui.back);

    if (!p) {
      root.append(back, el('p', {}, ui.not_found));
      return;
    }
    document.title = `${p.title} — ${site.name}`;

    const facts = [
      [ui.context, p.context],
      [ui.team, p.team],
      [ui.role, p.role],
    ];

    const links = (p.links || []).map((l) => el('li', {}, link(l.label, l.url)));
    if (p.privateRepo) links.push(el('li', { class: 'meta' }, ui.private_repo));

    root.append(
      back,
      el('header', { class: 'project-head' },
        el('p', { class: 'meta' }, p.period),
        el('h1', {}, p.title),
        el('p', { class: 'pitch lead' }, p.pitch),
        p.highlight ? el('p', { class: 'metric big' },
          el('strong', {}, p.highlight.value), ' ', el('span', {}, p.highlight.label)) : null,
        tags(p.tags)),
      image(p.cover, p.title, ui.missing_image, 'media project-cover'),
      el('dl', { class: 'facts' }, facts.flatMap(([k, v]) => [el('dt', {}, k), text(v, 'dd')])),
      el('section', { class: 'block' }, el('h2', {}, ui.problem), text(p.problem, 'p')),
      el('section', { class: 'block' }, el('h2', {}, ui.work),
        el('ul', {}, p.work.map((w) => text(w, 'li')))),
      el('section', { class: 'block' }, el('h2', {}, ui.result),
        el('ul', {}, p.result.map((r) => text(r, 'li')))),
      links.length ? el('section', { class: 'block' }, el('h2', {}, ui.links),
        el('ul', { class: 'links' }, links)) : null,
      p.gallery && p.gallery.length ? el('section', { class: 'block' }, el('h2', {}, ui.gallery),
        el('div', { class: 'gallery' }, p.gallery.map((g) =>
          el('figure', {}, image(g.src, g.caption, ui.missing_image), text(g.caption, 'figcaption'))))) : null
    );
  }

  // ---------- Démarrage ----------

  async function main() {
    try {
      const { lang, langs } = await resolveLang();
      document.documentElement.lang = lang;
      const [site, projects] = await Promise.all([
        loadJSON(`content/${lang}/site.json`),
        loadJSON(`content/${lang}/projects.json`),
      ]);
      fillStatic(site);
      setupTheme(site.ui);
      renderLangSwitch(lang, langs);
      document.querySelectorAll('.brand, .nav a[href^="./"]').forEach((a) =>
        a.setAttribute('href', withLang(a.getAttribute('href'), lang)));

      if (document.body.dataset.page === 'project') renderProject(site, projects, lang);
      else renderHome(site, projects, lang);
    } catch (err) {
      console.error(err);
      const msg = location.protocol === 'file:'
        ? 'Ouvrez le site via un serveur local (ex. « python3 -m http.server »), pas en double-cliquant sur le fichier.'
        : 'Impossible de charger le contenu du site.';
      document.querySelector('main').prepend(el('p', { class: 'error' }, msg));
    }
  }

  main();
})();
