(() => {
  const categoryOverrides = {'BA-06':'Glaswaschtische','BA-W':'Glaswaschtische','BA-05':'Glaswaschtische','BA-03':'Glaswaschtische','BA-M4':'Glaswaschtische','BA-RD':'Duschen','BA-ED':'Duschen','BA-FD':'Duschen','BA-SD':'Duschen','BA-D':'Glastüren','BA-P':'Glastüren','DIV 04':'Tische & Möbel'};
  const products = (window.CREA_CATALOG || []).map(product => ({...product, category: categoryOverrides[product.code] || product.category}));
  const service = window.CreaService;
  const SALE = 'Fundgrube – Ausstellungsverkauf';
  const WHATSAPP = '41794152056';
  const EMAIL = 'verkauf@crea-glass.ch';
  const SHOP = 'https://crea-glass.ch/shop/';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = selector => document.querySelector(selector);
  const grid = $('#product-grid');
  const search = $('#search');
  const availability = $('#availability');
  const sort = $('#sort');
  const priceMax = $('#price-max');
  const categoryList = $('#category-list');
  const dialog = $('#product-dialog');
  const shortlistDialog = $('#shortlist-dialog');
  const keys = {shortlist:'crea_glass_shortlist_v1', location:'crea_glass_location_v1', recent:'crea_glass_recent_v1'};
  let shortlist = new Set();
  let recent = [];
  let activeProduct = null;
  let location = null;
  let feedbackTimer;
  try {
    const stored = JSON.parse(localStorage.getItem(keys.shortlist) || '[]');
    if (Array.isArray(stored)) shortlist = new Set(stored.filter(id => products.some(product => product.id === id && !product.sold)));
    const storedLocation = JSON.parse(localStorage.getItem(keys.location) || 'null');
    if (storedLocation && Number.isFinite(storedLocation.km)) location = storedLocation;
    const storedRecent = JSON.parse(localStorage.getItem(keys.recent) || '[]');
    if (Array.isArray(storedRecent)) recent = storedRecent.filter(id => products.some(product => product.id === id));
  } catch (_) { /* Speicher kann gesperrt sein. Die Seite funktioniert trotzdem. */ }
  const categories = ['Alle', 'Glaswaschtische', 'Duschen', 'Glastüren', 'Glastrennwände', 'Spiegel', 'Glasbilder', 'Tische & Möbel', 'Zubehör', 'Neue Glasplatten'];
  let category = 'Alle';
  let application = null;
  let limit = 24;

  const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase();
  const fmt = value => new Intl.NumberFormat('de-CH', {maximumFractionDigits:0}).format(value);
  const money = value => `CHF ${fmt(value)}.–`;
  const moneyRange = (a, b) => a === b ? money(a) : `CHF ${fmt(a)}–${fmt(b)}.–`;
  const hours = value => String(value).replace('.', ',');
  const regularPrice = product => product.shopRegular && product.displayPrice && product.shopRegular > product.displayPrice ? product.shopRegular : null;
  const savings = product => { const regular = regularPrice(product); return regular ? Math.round((1 - product.displayPrice / regular) * 100) : 0; };
  const cartUrl = product => product.shopId ? `${SHOP}?add-to-cart=${product.shopId}` : null;

  function priceInfo(product) {
    if (product.sold) return {value:'Verkauft', caption:'Dieses Stück ist nicht mehr verfügbar'};
    if (product.priceBasis === 'on_request') return {value:'Preis auf Anfrage', caption:'Offerte nach Mass und Einsatz'};
    if (product.priceBasis === 'confirmed_november_2026') return {value:money(product.displayPrice), caption:'Aktionspreis November · exkl. MwSt'};
    if (product.priceBasis === 'shop_current') return {value:money(product.displayPrice), caption:'Preis wie im Shop · exkl. MwSt'};
    return {value:money(product.displayPrice), caption:'Katalogpreis · wird bestätigt · exkl. MwSt'};
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  const heartSvg = () => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 4.6 6.2 4.1c2-.3 3.9.6 5.8 2.7 1.9-2.1 3.8-3 5.8-2.7 3.6.5 5.3 4.3 3.8 7.7C19.5 16.4 12 21 12 21z'); svg.append(path); return svg; };

  function feedback(text) {
    $('#selection-feedback').textContent = text;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { $('#selection-feedback').textContent = ''; }, 3000);
  }

  function fadeImage(image) {
    image.classList.add('fade-image');
    const done = () => image.classList.add('is-loaded');
    if (image.complete && image.naturalWidth) done(); else image.addEventListener('load', done, {once:true});
    image.addEventListener('error', done, {once:true});
  }

  function productImage(product, alt) {
    const image = node('img');
    image.src = product.image; image.alt = alt || `${product.title} – ${product.code}`;
    image.loading = 'lazy'; image.decoding = 'async'; image.width = 1024; image.height = 1024;
    fadeImage(image);
    return image;
  }

  function badges(product) {
    const list = [];
    if (product.sold) list.push(['Verkauft', 'neutral']);
    else {
      const pct = savings(product);
      if (pct >= 10) list.push([`−${pct}%`, '']);
      list.push(['Einzelstück · neu', 'neutral']);
    }
    return list.map(([text, kind]) => node('span', `badge ${kind}`.trim(), text));
  }

  /* ---------- Merkliste ---------- */
  const selectedProducts = () => products.filter(product => shortlist.has(product.id) && !product.sold);
  function saveShortlist() {
    try { localStorage.setItem(keys.shortlist, JSON.stringify([...shortlist])); } catch (_) { /* optional */ }
    updateShortlistUI();
  }
  function toggleShortlist(product) {
    if (product.sold) return;
    if (shortlist.has(product.id)) shortlist.delete(product.id); else shortlist.add(product.id);
    saveShortlist();
    feedback(shortlist.has(product.id) ? `${product.code} auf der Merkliste` : `${product.code} entfernt`);
  }
  function updateShortlistUI() {
    $('#shortlist-count').textContent = String(shortlist.size);
    $('#open-shortlist').classList.toggle('has-items', shortlist.size > 0);
    for (const button of document.querySelectorAll('.save-button')) {
      const selected = shortlist.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', selected ? 'Von der Merkliste entfernen' : 'Auf die Merkliste');
    }
    if (activeProduct && !activeProduct.sold) {
      const selected = shortlist.has(activeProduct.id);
      $('#dialog-save').setAttribute('aria-pressed', String(selected));
      $('#dialog-save').textContent = selected ? '♥ Gemerkt' : '♡ Merken';
    }
    if (shortlistDialog.open) renderShortlist();
  }
  function renderShortlist() {
    const selected = selectedProducts();
    const container = $('#shortlist-items');
    container.replaceChildren();
    for (const product of selected) {
      const item = node('div', 'shortlist-item');
      const details = node('div');
      details.append(node('strong', '', `${product.code} · ${product.title}`), node('span', '', `${priceInfo(product).value} · ${priceInfo(product).caption}`));
      const remove = node('button', '', 'Entfernen'); remove.type = 'button';
      remove.setAttribute('aria-label', `${product.code} von der Merkliste entfernen`);
      remove.addEventListener('click', () => toggleShortlist(product));
      item.append(productImage(product, product.title), details, remove);
      container.append(item);
    }
    if (!selected.length) container.append(node('p', 'shortlist-empty', 'Ihre Merkliste ist leer. Tippen Sie im Katalog auf das Herz, oder fragen Sie einen Beratungstermin ohne Vorauswahl an.'));
    updateInquiryLinks();
  }
  function openShortlist() { renderShortlist(); if (!shortlistDialog.open) shortlistDialog.showModal(); }

  /* ---------- Zuletzt angesehen ---------- */
  function rememberRecent(product) {
    recent = [product.id, ...recent.filter(id => id !== product.id)].slice(0, 8);
    try { localStorage.setItem(keys.recent, JSON.stringify(recent)); } catch (_) { /* optional */ }
    renderRecent();
  }
  function renderRecent() {
    const section = $('#recent-section'); const rail = $('#recent-rail');
    const list = recent.map(id => products.find(product => product.id === id)).filter(Boolean);
    section.hidden = list.length < 2;
    rail.replaceChildren();
    for (const product of list) {
      const button = node('button', 'recent-item'); button.type = 'button';
      button.append(productImage(product), node('span', '', product.title), node('b', '', priceInfo(product).value));
      button.addEventListener('click', () => openProduct(product));
      rail.append(button);
    }
  }

  /* ---------- Highlights & Räume ---------- */
  function renderHighlights() {
    const container = $('#highlight-grid');
    const saved = product => regularPrice(product) - product.displayPrice;
    const list = products.filter(product => !product.sold && regularPrice(product)).sort((a, b) => saved(b) - saved(a)).slice(0, 5);
    for (const product of list) {
      const card = node('button', 'highlight'); card.type = 'button';
      card.append(...badges(product).slice(0, 1), productImage(product), node('div', 'shade'));
      const copy = node('div', 'copy');
      const price = node('div', 'price');
      price.append(node('b', '', money(product.displayPrice)), node('s', '', `statt ${money(regularPrice(product))}`));
      copy.append(node('small', '', `${product.code} · ${product.category}`), node('strong', '', product.title), price);
      card.append(copy);
      card.addEventListener('click', () => openProduct(product));
      container.append(card);
    }
  }
  const rooms = [
    {title:'Badezimmer', caption:'Glaswaschtische, Spiegel und Zubehör', categories:['Glaswaschtische','Spiegel','Zubehör'], cover:'la-49-led-glass-washbasin-with-cabinet', idea:'Für Ihr Bad: Bringen Sie ein Foto und die verfügbaren Masse mit. Anschlüsse und Einbausituation klären wir vor der Entscheidung.'},
    {title:'Duschen', caption:'Komplette Glasduschen und Duschtüren', categories:['Duschen'], cover:'ba-rd-round-shower', idea:'Für Ihre Dusche: Nischenmass, Bodenaufbau und Wandanschluss entscheiden über den Einbau. Wir prüfen das gemeinsam.'},
    {title:'Türen & Trennwände', caption:'Glastüren und Raumteiler', categories:['Glastüren','Glastrennwände'], cover:'tw-01-curved-orca-glass-partition', idea:'Für Ihren Grundriss: Lichtwirkung und Privatsphäre vergleichen. Glasart, Beschläge und Einbaumasse müssen zur Anwendung passen.'},
    {title:'Spiegel & Glasbilder', caption:'Licht und Kunst für die Wand', categories:['Spiegel','Glasbilder'], cover:'sp-17-glass-mirror', idea:'Für Ihre Wand: Proportion und Lichtfarbe im Raum prüfen. Bei LED braucht es eine Zuleitung.'},
    {title:'Tische & Möbel', caption:'Esstische, Bartheke, Badmöbel', categories:['Tische & Möbel'], cover:'ti-06-bamboo-glass-table', idea:'Für Ihren Wohnraum: Proportionen, Farbe und Oberfläche im Zusammenspiel mit Ihren Möbeln prüfen.'},
    {title:'Glasplatten für Profis', caption:'Strukturglas für Duschwand, Raumteiler, Lichtwand', categories:['Neue Glasplatten'], cover:'tw-24', idea:'Für Fachbetriebe: Masse und Glasstärke stehen bei jeder Platte. Beschläge und Einbau nach Projekt, Preis nach Mass.'}
  ];
  function renderRooms() {
    const container = $('#room-grid');
    for (const room of rooms) {
      const count = products.filter(product => room.categories.includes(product.category) && !product.sold).length;
      const tile = node('button', 'room'); tile.type = 'button';
      const cover = products.find(product => product.image.includes(room.cover)) || products.find(product => room.categories.includes(product.category));
      tile.append(productImage(cover, ''));
      const copy = node('div', 'copy');
      copy.append(node('strong', '', room.title), node('span', '', `${room.caption} · ${count} Stücke`), node('span', 'go', 'Entdecken'));
      tile.append(copy);
      tile.addEventListener('click', () => { category = 'Alle'; application = room; search.value = ''; availability.value = 'available'; priceMax.value = ''; limit = 24; render(); $('#toolbar').scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth'}); });
      container.append(tile);
    }
  }

  /* ---------- Katalog ---------- */
  function renderCategories() {
    categoryList.replaceChildren();
    for (const name of categories) {
      const count = name === 'Alle' ? products.filter(p => !p.sold).length : products.filter(product => product.category === name && !product.sold).length;
      const button = node('button', '', name); button.type = 'button';
      button.setAttribute('aria-pressed', String(category === name && !application));
      button.append(node('small', '', String(count)));
      button.addEventListener('click', () => { category = name; application = null; limit = 24; render(); });
      categoryList.append(button);
    }
  }
  function filteredProducts() {
    const query = normalize(search.value).trim();
    const words = query.split(/\s+/).filter(Boolean);
    const compact = value => normalize(value).replace(/[^a-z0-9]/g, '');
    const exactCode = query ? products.find(product => compact(product.code) === compact(query)) : null;
    const status = availability.value;
    const max = Number(priceMax.value) || 0;
    const selected = products.filter(product => {
      if (category !== 'Alle' && product.category !== category) return false;
      if (application && !application.categories.includes(product.category)) return false;
      if (status === 'available' && product.sold) return false;
      if (status === 'sold' && !product.sold) return false;
      if (max && (product.displayPrice == null || product.displayPrice > max)) return false;
      if (exactCode) return product.id === exactCode.id;
      const haystack = normalize([product.code, product.title, product.tagline, product.description, product.category].join(' '));
      return words.every(word => haystack.includes(word));
    });
    const byCode = (a, b) => a.code.localeCompare(b.code, 'de-CH', {numeric:true});
    const order = sort.value;
    if (order === 'code') selected.sort(byCode);
    if (order === 'savings') selected.sort((a, b) => savings(b) - savings(a) || (b.displayPrice || 0) - (a.displayPrice || 0));
    if (order === 'price-asc' || order === 'price-desc') selected.sort((a, b) => {
      const ap = a.sold || a.displayPrice == null ? Infinity : a.displayPrice;
      const bp = b.sold || b.displayPrice == null ? Infinity : b.displayPrice;
      if (ap === Infinity && bp === Infinity) return byCode(a, b);
      if (ap === Infinity) return 1; if (bp === Infinity) return -1;
      return order === 'price-asc' ? ap - bp : bp - ap;
    });
    if (order === 'featured') selected.sort((a, b) => Number(a.sold) - Number(b.sold) || Number(b.priceBasis === 'confirmed_november_2026') - Number(a.priceBasis === 'confirmed_november_2026') || savings(b) - savings(a) || Number(b.shopId != null) - Number(a.shopId != null) || byCode(a, b));
    return selected;
  }
  function card(product, index = 0) {
    const article = node('article', 'product-card reveal');
    article.style.setProperty('--i', String(Math.min(index % 8, 7)));
    const imageBox = node('div', 'card-image');
    const imageLink = node('button', 'image-link'); imageLink.type = 'button';
    imageLink.setAttribute('aria-label', `Details ansehen: ${product.code}`);
    imageLink.append(productImage(product));
    imageLink.addEventListener('click', () => openProduct(product));
    imageBox.append(imageLink, ...badges(product));
    if (!product.sold) {
      const save = node('button', 'save-button'); save.type = 'button'; save.dataset.id = product.id;
      save.setAttribute('aria-pressed', String(shortlist.has(product.id)));
      save.setAttribute('aria-label', shortlist.has(product.id) ? 'Von der Merkliste entfernen' : 'Auf die Merkliste');
      save.append(heartSvg());
      save.addEventListener('click', () => toggleShortlist(product));
      imageBox.append(save);
    }
    const body = node('div', 'card-body');
    const meta = node('div', 'card-meta'); meta.append(node('span', '', product.code), node('span', '', product.category));
    const title = node('h3', 'card-title');
    const titleButton = node('button', '', product.title); titleButton.type = 'button';
    titleButton.addEventListener('click', () => openProduct(product));
    title.append(titleButton);
    const info = priceInfo(product);
    const price = node('div', `card-price${product.sold ? ' sold' : ''}`);
    price.append(node('strong', '', info.value));
    const regular = regularPrice(product);
    if (regular && !product.sold) price.append(node('s', '', money(regular)));
    price.append(node('small', '', info.caption));
    const actions = node('div', 'card-actions');
    const details = node('button', 'button button-outline', 'Details'); details.type = 'button';
    details.addEventListener('click', () => openProduct(product));
    if (product.sold) { details.textContent = 'Ähnliche Stücke'; details.classList.add('single'); actions.append(details); }
    else if (cartUrl(product)) {
      const cart = node('a', 'button', 'In den Warenkorb'); cart.href = cartUrl(product); cart.target = '_blank'; cart.rel = 'noopener noreferrer';
      cart.addEventListener('click', () => feedback(`${product.code} wird im Crea-Glass Shop in den Warenkorb gelegt`));
      actions.append(details, cart);
    } else {
      const ask = node('button', 'button', product.priceBasis === 'on_request' ? 'Preis anfragen' : 'Anfragen'); ask.type = 'button';
      ask.addEventListener('click', () => beginInquiry('pickup', product));
      actions.append(details, ask);
    }
    body.append(meta, title, node('p', 'card-tagline', product.tagline || product.description), price, actions);
    article.append(imageBox, body);
    return article;
  }
  const groupedMode = () => category === 'Alle' && !application && !normalize(search.value).trim() && !priceMax.value && availability.value === 'available' && sort.value === 'featured';
  const groupPreview = () => window.matchMedia('(max-width: 640px)').matches ? 2 : 4;
  function renderGroups(list) {
    const groups = $('#product-groups');
    groups.replaceChildren();
    let index = 0;
    for (const name of categories.slice(1)) {
      const items = list.filter(product => product.category === name);
      if (!items.length) continue;
      const section = node('section', 'group');
      section.setAttribute('aria-label', name);
      const head = node('div', 'group-head');
      const title = node('h3', '', name); title.append(node('small', '', `${items.length} ${items.length === 1 ? 'Stück' : 'Stücke'}`));
      const more = node('button', '', items.length > groupPreview() ? `Alle ${items.length} ansehen` : 'Kategorie öffnen'); more.type = 'button';
      more.addEventListener('click', () => { category = name; application = null; limit = 24; render(); $('#toolbar').scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth'}); });
      head.append(title, more);
      const rows = node('div', 'product-grid');
      items.slice(0, groupPreview()).forEach(product => rows.append(card(product, index++)));
      section.append(head, rows);
      if (items.length > groupPreview()) {
        const foot = node('div', 'group-foot');
        const rest = node('button', '', `+ ${items.length - groupPreview()} weitere ${name}`); rest.type = 'button';
        rest.addEventListener('click', () => { category = name; application = null; limit = 24; render(); section.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block:'start'}); });
        foot.append(rest); section.append(foot);
      }
      groups.append(section);
    }
    observeReveal(groups.querySelectorAll('.reveal'));
  }
  function render() {
    renderCategories();
    const context = $('#application-context');
    context.hidden = !application;
    context.textContent = application ? `${application.title}: ${application.caption}. Filter zurücksetzen zeigt wieder alle Stücke.` : '';
    const list = filteredProducts();
    const grouped = groupedMode();
    $('#empty-state').hidden = list.length > 0;
    const more = $('#load-more');
    if (grouped) {
      $('#result-count').replaceChildren(node('span', '', `${list.length} Stücke in ${categories.length - 1} Kategorien.`), node('span', 'count-long', ` Pro Kategorie zeigen wir ${groupPreview()} Stücke – «Alle ansehen» öffnet die ganze Kategorie.`));
      $('#clear-filters').hidden = true;
      grid.replaceChildren(); grid.hidden = true; $('#product-groups').hidden = false;
      renderGroups(list);
      more.hidden = true;
      return;
    }
    $('#product-groups').hidden = true; grid.hidden = false; $('#clear-filters').hidden = false;
    const label = application ? application.title : category !== 'Alle' ? category : 'Treffer';
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'Stück' : 'Stücke'} · ${label}`;
    const shown = list.slice(0, limit);
    const fragment = document.createDocumentFragment();
    shown.forEach((product, index) => fragment.append(card(product, index)));
    grid.replaceChildren(fragment);
    observeReveal(grid.querySelectorAll('.reveal'));
    more.hidden = shown.length >= list.length;
    more.textContent = `Weitere ${label === 'Treffer' ? 'Stücke' : label} anzeigen (${list.length - shown.length})`;
  }
  function clearFilters() {
    search.value = ''; availability.value = 'available'; sort.value = 'featured'; priceMax.value = '';
    category = 'Alle'; application = null; limit = 24; render();
  }

  /* ---------- Produkt ---------- */
  const productUrl = product => `${window.location.origin}${window.location.pathname}#artikel/${product.id}`;
  function productFromLocation() {
    const hash = decodeURIComponent(window.location.hash || '');
    const fromQuery = new URLSearchParams(window.location.search).get('artikel');
    const match = hash.match(/^#artikel\/(.+)$/) || (fromQuery ? [null, fromQuery] : null);
    if (!match) return null;
    const key = normalize(match[1]).replace(/[^a-z0-9]/g, '');
    return products.find(product => product.id === match[1]) || products.find(product => normalize(product.code).replace(/[^a-z0-9]/g, '') === key) || null;
  }
  function setProductHash(product) {
    const url = product ? `#artikel/${product.id}` : `${window.location.pathname}${window.location.search}`;
    if (product ? window.location.hash !== url : window.location.hash) history.replaceState(null, '', url);
  }
  const complements = {
    'Glaswaschtische': ['DIV 15', 'DIV 16', 'Steel brackets', 'CR-2070', 'SP 15', 'SP 16'],
    'Duschen': ['DIV 07', 'DIV 08', 'DIV 06', 'Giese Provider'],
    'Spiegel': ['LA 50', 'LA 58', 'LA 57'],
    'Glastüren': ['TW 06', 'TW 11', 'GL 02'],
    'Glastrennwände': ['TÜ 01', 'TÜ 18', 'TW 17'],
    'Glasbilder': ['SP 17', 'SP 11', 'BI 02'],
    'Tische & Möbel': ['BI 01', 'BI 06', 'DIV 05'],
    'Zubehör': ['LA 52', 'LA 62', 'LA 23'],
    'Neue Glasplatten': ['TW 01', 'TW 13', 'TÜ 09']
  };
  function relatedTo(product) {
    const wanted = (complements[product.category] || []).map(code => products.find(p => p.code === code)).filter(p => p && !p.sold && p.id !== product.id);
    const same = products.filter(p => p.category === product.category && p.id !== product.id && !p.sold);
    return [...wanted, ...same].filter((p, i, arr) => arr.indexOf(p) === i).slice(0, 3);
  }
  function openProduct(product, {fromLocation = false} = {}) {
    activeProduct = product;
    const image = $('#dialog-image');
    image.classList.remove('is-loaded'); image.src = product.image; image.alt = `${product.title} – ${product.description}`; fadeImage(image);
    $('#dialog-badges').replaceChildren(...badges(product));
    $('#dialog-category').textContent = product.category;
    $('#dialog-title').textContent = product.title;
    $('#dialog-tagline').textContent = product.tagline || '';
    $('#dialog-code').textContent = `Artikelcode ${product.code} · Einzelstück, neu und unbenutzt`;
    const info = priceInfo(product);
    $('#dialog-price').textContent = info.value;
    const regular = regularPrice(product);
    $('#dialog-regular').hidden = !regular || product.sold;
    $('#dialog-regular').textContent = regular ? `statt ${money(regular)}` : '';
    $('#dialog-price-caption').textContent = info.caption;
    $('#dialog-description').textContent = product.description;
    const rows = $('#dialog-prices'); rows.replaceChildren();
    if (product.prices.length > 1) for (const row of product.prices) { const line = node('div', 'price-row'); line.append(node('span', '', row.label), node('strong', '', money(row.value))); rows.append(line); }
    const notes = [];
    if (product.sold) notes.push('Dieses Stück ist verkauft. Wir fertigen es auf Wunsch neu an oder zeigen Ihnen Alternativen.');
    else if (product.priceBasis === 'on_request') notes.push('Für dieses Stück offerieren wir nach Mass und Einsatz. Fragen Sie mit dem Artikelcode an.');
    else if (product.priceBasis === 'reference_may_2025') notes.push('Richtwert aus unserem Katalog; den aktuellen Preis bestätigen wir mit Ihrer Anfrage.');
    else notes.push('Kann in unserer Ausstellung besichtigt und abgeholt werden. Lieferung und Montage siehe unten.');
    $('#dialog-note').textContent = notes.join(' ');
    renderDialogService(product);
    const cart = $('#dialog-cart');
    const url = cartUrl(product);
    cart.hidden = product.sold || !url;
    $('#cart-note').hidden = cart.hidden;
    if (url) cart.href = url;
    $('#product-offer').hidden = product.sold;
    $('#product-offer').textContent = product.priceBasis === 'on_request' ? 'Offerte anfragen' : 'Lieferung & Montage anfragen';
    $('#dialog-save').hidden = product.sold;
    $('#product-visit').hidden = product.sold;
    const inquiry = product.sold
      ? `Guten Tag, ${product.code} ist verkauft. Haben Sie ein ähnliches Stück oder fertigen Sie es neu an?`
      : `Guten Tag, ich interessiere mich für ${product.code} (${product.title}) aus der Fundgrube. Bitte teilen Sie mir Verfügbarkeit und die Möglichkeiten für Abholung, Lieferung oder Montage mit.\n${productUrl(product)}`;
    $('#dialog-whatsapp').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(inquiry)}`;
    $('#dialog-email').href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Anfrage ${product.code} – ${SALE}`)}&body=${encodeURIComponent(inquiry)}`;
    $('#mobile-price').textContent = info.value;
    $('#mobile-caption').textContent = regular && !product.sold ? `statt ${money(regular)} · exkl. MwSt` : info.caption;
    const primary = $('#mobile-primary');
    primary.textContent = product.sold ? 'Alternativen' : url ? 'In den Warenkorb' : 'Anfragen';
    primary.onclick = () => { if (product.sold) { $('#related-products').scrollIntoView({behavior:'smooth'}); } else if (url) { window.open(url, '_blank', 'noopener'); feedback(`${product.code} wird im Crea-Glass Shop in den Warenkorb gelegt`); } else beginInquiry('pickup', product); };
    updateShortlistUI();
    updateProductNavigation(product);
    if (!fromLocation) setProductHash(product);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    rememberRecent(product);
  }
  function renderDialogService(product) {
    const box = $('#dialog-service'); box.replaceChildren();
    if (!service || product.sold) { box.hidden = true; return; }
    const hint = service.productHint(product);
    if (!hint) { box.hidden = true; return; }
    box.hidden = false;
    box.append(node('h3', '', 'Abholung, Lieferung, Montage'));
    const list = node('ul', 'service-hint-list');
    const row = (label, value) => { const li = node('li'); li.append(node('span', '', label), node('strong', '', value)); return li; };
    list.append(row('Abholung in Unterseen', 'kostenlos'), row('Lieferung', hint.delivery), row(`Montage, ca. ${hours(hint.hours[0])}–${hours(hint.hours[1])} h`, `${moneyRange(hint.priceRange[0], hint.priceRange[1])} zzgl. Anfahrt`));
    box.append(list);
    if (hint.note) box.append(node('p', 'small', hint.note));
    const button = node('button', 'link-button', 'Richtpreis für meinen Standort berechnen'); button.type = 'button';
    button.addEventListener('click', () => beginInquiry('install', product));
    box.append(button);
  }
  function updateProductNavigation(product) {
    const list = (() => { const l = filteredProducts(); return l.some(p => p.id === product.id) ? l : products; })();
    const index = list.findIndex(p => p.id === product.id);
    $('#product-position').textContent = `${index + 1} / ${list.length}`;
    $('#product-prev').disabled = index <= 0;
    $('#product-next').disabled = index >= list.length - 1;
    $('#product-prev').onclick = () => { if (index > 0) openProduct(list[index - 1]); };
    $('#product-next').onclick = () => { if (index < list.length - 1) openProduct(list[index + 1]); };
    const related = $('#related-products'); related.replaceChildren();
    const items = relatedTo(product);
    if (!items.length) return;
    related.append(node('h3', '', product.sold ? 'Verfügbare Alternativen' : 'Passt dazu'));
    const wrap = node('div', 'related-grid');
    for (const p of items) {
      const button = node('button', 'related-item'); button.type = 'button';
      button.append(productImage(p, ''), node('span', '', `${p.code} · ${p.title}`), node('b', '', priceInfo(p).value));
      button.addEventListener('click', () => openProduct(p));
      wrap.append(button);
    }
    related.append(wrap);
  }
  async function shareProduct() {
    if (!activeProduct) return;
    const url = productUrl(activeProduct);
    const data = {title: `${activeProduct.code} · ${activeProduct.title}`, text: `${activeProduct.title} – Crea-Glass Fundgrube`, url};
    try {
      if (navigator.share && navigator.canShare?.(data)) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url); feedback('Link kopiert');
    } catch (error) { if (error?.name !== 'AbortError') window.prompt('Link zu diesem Stück kopieren:', url); }
  }
  const closeProductDialog = () => { if (dialog.open) dialog.close(); };

  /* ---------- Standort, Zone, Richtpreis ---------- */
  function saveLocation() { try { if (location) localStorage.setItem(keys.location, JSON.stringify(location)); else localStorage.removeItem(keys.location); } catch (_) { /* optional */ } }
  async function resolveLocation(input, statusElement, useDevice = false) {
    if (!service) throw new Error('Berechnung nicht verfügbar.');
    statusElement.textContent = useDevice ? 'Standort wird abgefragt …' : 'Standort wird gesucht …';
    statusElement.classList.remove('is-error');
    const point = useDevice ? await service.locate() : await service.geocode(input);
    const distance = await service.roadDistanceKm(point);
    location = {lat: point.lat, lon: point.lon, label: point.label, km: distance.km, estimated: distance.estimated || Boolean(point.approximate)};
    saveLocation();
    statusElement.textContent = `${location.label} · ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km ab Werk`;
    return location;
  }
  const describeStatus = (statusElement, error) => { statusElement.textContent = error.message || 'Standort nicht gefunden.'; statusElement.classList.add('is-error'); };
  function renderServiceSection() {
    if (!service) return;
    const tariff = service.TARIFF;
    document.querySelectorAll('[data-tariff="delivery-a"]').forEach(el => el.textContent = fmt(tariff.zones[0].delivery));
    document.querySelectorAll('[data-tariff="free-from"]').forEach(el => el.textContent = fmt(tariff.freeDeliveryFrom));
    document.querySelectorAll('[data-tariff="rate"]').forEach(el => el.textContent = fmt(tariff.hourlyRate));
    const zones = $('#service-zones'); zones.replaceChildren();
    const table = node('table', 'zone-table');
    const head = node('tr'); ['Zone', 'Lieferung', 'Anfahrt Montage'].forEach(text => head.append(node('th', '', text))); table.append(head);
    for (const zone of tariff.zones) {
      const row = node('tr'); const first = node('td'); first.append(node('strong', '', zone.label), node('small', '', zone.area));
      row.append(first, node('td', '', zone.delivery == null ? 'Offerte' : money(zone.delivery)), node('td', '', zone.travel == null ? 'Offerte' : zone.travel === 0 ? 'inbegriffen' : money(zone.travel)));
      table.append(row);
    }
    zones.append(table, node('p', 'service-footnote', `Lieferung gratis ab ${money(tariff.freeDeliveryFrom)} Warenwert in den Zonen A–C. Bei Montage ist die Lieferung immer inbegriffen. Kleines Zubehör versenden wir per Post für ${money(tariff.postalShipping)}.`));
    if (location) { $('#location-input').value = location.label; $('#location-status').textContent = `${location.label} · ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km ab Werk`; renderServiceResult(); }
  }
  function renderServiceResult() {
    const result = $('#service-result');
    if (!location) { result.hidden = true; return; }
    const zone = service.zoneFor(location.km); const tariff = service.TARIFF; const selected = selectedProducts();
    $('#service-zone-label').textContent = zone.label;
    $('#service-distance').textContent = `${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km ab Werk · ${location.label}`;
    const options = $('#service-options'); options.replaceChildren();
    const option = (title, value, caption) => { const box = node('div', 'service-option'); box.append(node('span', 'service-option-title', title), node('strong', '', value), node('small', '', caption)); return box; };
    options.append(option('Abholung ab Werk', 'kostenlos', 'Eichzun 4, Unterseen · nach Terminabsprache'));
    if (zone.delivery == null) options.append(option('Lieferung', 'Offerte', 'Ausserhalb der Lieferzonen – wir offerieren individuell'));
    else {
      const delivery = selected.length ? service.estimate(selected, 'delivery', location.km) : null;
      const value = delivery ? (delivery.total === 0 ? 'gratis' : money(delivery.total)) : money(zone.delivery);
      options.append(option('Lieferung ohne Montage', value, delivery && delivery.total === 0 && delivery.value >= tariff.freeDeliveryFrom ? `Ihre Merkliste liegt über ${money(tariff.freeDeliveryFrom)} Warenwert` : `Pro Auftrag · gratis ab ${money(tariff.freeDeliveryFrom)} Warenwert`));
    }
    if (zone.travel == null) options.append(option('Lieferung + Montage', 'Offerte', 'Ausserhalb der Montagezonen – wir offerieren individuell'));
    else {
      const install = selected.length ? service.estimate(selected, 'install', location.km) : null;
      if (install && !install.onRequest) options.append(option('Lieferung + Montage', moneyRange(install.total, install.totalMax), `${install.items} ${install.items === 1 ? 'Stück' : 'Stücke'} · ${hours(install.hours[0])}–${hours(install.hours[1])} h Montage · Anfahrt ${zone.travel ? money(zone.travel) : 'inbegriffen'}`));
      else options.append(option('Lieferung + Montage', `${zone.travel ? money(zone.travel) + ' + ' : ''}${money(tariff.hourlyRate)}/h`, 'Lieferung inbegriffen · Montagezeit je nach Stück, siehe Produkt'));
    }
    $('#service-to-shortlist').textContent = selected.length ? 'Anfrage mit Richtpreis senden' : 'Stücke merken und berechnen';
    result.hidden = false;
  }
  async function handleLocationForm(event) {
    event.preventDefault();
    const status = $('#location-status');
    try { await resolveLocation($('#location-input').value, status); renderServiceResult(); $('#inquiry-location').value = location.label; }
    catch (error) { describeStatus(status, error); }
  }
  async function handleLocate(statusElement, inputElement) {
    try { await resolveLocation('', statusElement, true); inputElement.value = location.label; renderServiceResult(); updateInquiryLinks(); }
    catch (error) { describeStatus(statusElement, error); }
  }

  /* ---------- Anfrage ---------- */
  function currentEstimate() {
    const purpose = $('#inquiry-purpose').value;
    if (!service || purpose === 'visit') return null;
    return service.estimate(selectedProducts(), purpose, location ? location.km : null);
  }
  function renderInquiryEstimate() {
    const purpose = $('#inquiry-purpose').value;
    const block = $('#inquiry-location-block');
    block.hidden = !(purpose === 'delivery' || purpose === 'install');
    const box = $('#inquiry-estimate'); box.replaceChildren();
    const estimate = currentEstimate();
    if (!estimate || block.hidden) { box.hidden = true; return; }
    if (!estimate.items) { box.append(node('p', '', 'Merken Sie Stücke, um den Richtpreis zu sehen.')); box.hidden = false; return; }
    if (!location) { box.append(node('p', '', 'Standort eingeben, um Zone und Richtpreis zu sehen.')); box.hidden = false; return; }
    box.append(node('p', 'label', `${estimate.zone.label} · ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km`));
    for (const line of estimate.lines) {
      const row = node('div', 'price-row');
      const value = line.valueMax != null && line.valueMax !== line.value ? moneyRange(line.value, line.valueMax) : line.value === 0 ? 'inbegriffen' : money(line.value);
      row.append(node('span', '', line.label), node('strong', line.strike ? 'is-strike' : '', value));
      box.append(row);
    }
    if (estimate.onRequest) box.append(node('p', '', 'Individuelle Offerte – wir melden uns mit dem Preis.'));
    else { const total = node('div', 'price-row is-total'); total.append(node('span', '', estimate.mode === 'install' ? 'Richtpreis Lieferung + Montage' : 'Richtpreis Lieferung'), node('strong', '', estimate.total === 0 ? 'gratis' : moneyRange(estimate.total, estimate.totalMax))); box.append(total); }
    for (const note of estimate.notes) box.append(node('p', 'small', note));
    box.hidden = false;
  }
  function updateInquiryLinks() {
    const selected = selectedProducts();
    const purpose = $('#inquiry-purpose').value;
    const visit = purpose === 'visit';
    $('#visit-time-label').hidden = !visit;
    renderInquiryEstimate();
    const project = $('#inquiry-project').value.trim();
    const time = $('#inquiry-time').value.trim();
    const intro = {visit:'ich möchte einen Besuch im Showroom in Unterseen anfragen.', pickup:'ich möchte folgende Stücke ab Werk in Unterseen abholen und bitte um Bestätigung von Preis und Verfügbarkeit.', delivery:'ich möchte folgende Stücke geliefert bekommen und bitte um ein Angebot.', install:'ich möchte folgende Stücke geliefert und montiert bekommen und bitte um ein Angebot.'}[purpose];
    const lines = ['Guten Tag,', intro];
    if (selected.length) lines.push('Meine Merkliste:', ...selected.map(p => `${p.code} – ${p.title} (${priceInfo(p).value})`));
    const estimate = currentEstimate();
    if (estimate && estimate.items && location && (purpose === 'delivery' || purpose === 'install')) {
      lines.push(`Lieferort: ${location.label} (${estimate.zone.label}, ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km)`);
      if (estimate.onRequest) lines.push('Richtpreis: individuelle Offerte');
      else if (purpose === 'install') lines.push(`Richtpreis Lieferung + Montage laut Website: ${moneyRange(estimate.total, estimate.totalMax)} (Montage ${hours(estimate.hours[0])}–${hours(estimate.hours[1])} h × CHF ${service.TARIFF.hourlyRate}${estimate.zone.travel ? `, Anfahrt CHF ${estimate.zone.travel}` : ''})`);
      else lines.push(`Richtpreis Lieferung laut Website: ${estimate.total === 0 ? 'gratis' : money(estimate.total)}`);
    }
    if (project) lines.push(`Mein Projekt: ${project}`);
    if (visit && time) lines.push(`Mein Wunschtermin: ${time}`);
    lines.push({visit:'Bitte bestätigen Sie mir einen Termin sowie die Verfügbarkeit meiner Auswahl.', pickup:'Bitte bestätigen Sie mir Preis, Verfügbarkeit und einen Abholtermin.', delivery:'Bitte bestätigen Sie mir Preis, Lieferkosten und einen Liefertermin.', install:'Bitte bestätigen Sie mir Preis, Montageumfang und einen Montagetermin.'}[purpose]);
    const message = lines.join('\n');
    const label = {visit:'Besuch', pickup:'Abholung', delivery:'Lieferung', install:'Montage'}[purpose];
    $('#shortlist-whatsapp').textContent = `${label} per WhatsApp anfragen`;
    $('#shortlist-email').textContent = `${label} per E-Mail anfragen`;
    $('#shortlist-whatsapp').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
    $('#shortlist-email').href = `mailto:${EMAIL}?subject=${encodeURIComponent(`${label} – ${SALE}`)}&body=${encodeURIComponent(message)}`;
    $('#inquiry-explanation').textContent = visit ? 'Wir bestätigen Termin, Preis und Verfügbarkeit persönlich. Ihre Merkliste ist noch keine Reservierung.' : 'Richtpreise laut Website. Wir bestätigen Preis, Umfang und Termin persönlich. Diese Anfrage löst noch keine Bestellung aus.';
  }
  function beginInquiry(purpose, product) {
    if (product && !product.sold) { shortlist.add(product.id); saveShortlist(); }
    $('#inquiry-purpose').value = purpose;
    if (location) $('#inquiry-location').value = location.label;
    closeProductDialog();
    openShortlist();
    if ((purpose === 'delivery' || purpose === 'install') && !location) setTimeout(() => $('#inquiry-location').focus(), 50);
  }
  async function handleInquiryLocation() {
    const status = $('#inquiry-location-status'); const value = $('#inquiry-location').value.trim();
    if (!value) return;
    try { await resolveLocation(value, status); $('#location-input').value = location.label; renderServiceResult(); updateInquiryLinks(); }
    catch (error) { describeStatus(status, error); }
  }

  /* ---------- Header, Menü, Bewegung ---------- */
  const revealObserver = ('IntersectionObserver' in window && !reducedMotion) ? new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('in-view'); revealObserver.unobserve(entry.target); } }, {rootMargin:'0px 0px -8% 0px', threshold:0.08}) : null;
  function observeReveal(elements) { for (const element of elements) { if (!revealObserver) element.classList.add('in-view'); else revealObserver.observe(element); } }
  function setupHeader() {
    const header = $('#header7');
    const toggle = $('#menu-toggle'); const menu = $('#mobile-menu');
    const update = () => { const sticky = window.scrollY > 60 || menu.hidden === false; header.classList.toggle('sticky', sticky); header.classList.toggle('transparent', !sticky); };
    update();
    window.addEventListener('scroll', update, {passive:true});
    toggle.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); update(); });
    menu.addEventListener('click', event => { if (event.target.closest('a')) { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); update(); } });
    for (const item of document.querySelectorAll('.nav-menu > li.has-sub > a')) {
      item.addEventListener('click', event => {
        const li = item.parentElement;
        if (li.classList.contains('is-open')) return;
        event.preventDefault();
        for (const other of document.querySelectorAll('.nav-menu > li.is-open')) other.classList.remove('is-open');
        li.classList.add('is-open');
      });
    }
    document.addEventListener('click', event => { if (!event.target.closest('.nav-menu')) for (const li of document.querySelectorAll('.nav-menu > li.is-open')) li.classList.remove('is-open'); });
    const toTop = $('#to-top');
    const toggleTop = () => toTop.classList.toggle('is-visible', window.scrollY > 900);
    toggleTop(); window.addEventListener('scroll', toggleTop, {passive:true});
    toTop.addEventListener('click', () => window.scrollTo({top:0, behavior: reducedMotion ? 'auto' : 'smooth'}));
    const filterToggle = $('#filter-toggle'); const filterPanel = $('#filter-panel');
    filterToggle.addEventListener('click', () => { const open = filterPanel.classList.toggle('is-open'); filterToggle.setAttribute('aria-expanded', String(open)); });
    const toolbar = $('#toolbar');
    const syncToolbar = () => { toolbar.style.top = header.classList.contains('sticky') ? `${header.offsetHeight}px` : '0px'; };
    syncToolbar(); window.addEventListener('scroll', syncToolbar, {passive:true}); window.addEventListener('resize', syncToolbar);
  }
  function setupParallax() {
    const items = [...document.querySelectorAll('[data-parallax]')].map(element => ({element, factor: Number(element.dataset.parallax) || 0}));
    if (!items.length || reducedMotion) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      for (const {element, factor} of items) {
        const rect = (element.closest('.hero') || element.parentElement).getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) continue;
        const center = rect.top + rect.height / 2 - vh / 2;
        element.style.transform = element.classList.contains('hero-inner')
          ? `translate3d(0, ${Math.max(0, -rect.top) * -factor}px, 0)`
          : element.tagName === 'IMG' ? `translate3d(0, ${(-center * factor).toFixed(1)}px, 0) scale(1.12)` : `translate3d(0, ${(-rect.top * factor).toFixed(1)}px, 0)`;
        if (element.classList.contains('hero-inner')) element.style.opacity = String(Math.max(0, 1 - Math.max(0, -rect.top) / (rect.height * 0.7)));
      }
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', request, {passive:true});
    window.addEventListener('resize', request);
    update();
  }
  function setupContactForm() {
    $('#contact-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const body = `${form.get('message')}\n\n${form.get('name')}\n${form.get('email')}`;
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Nachricht über die Fundgrube')}&body=${encodeURIComponent(body)}`;
      feedback('Ihr E-Mail-Programm öffnet sich mit der Nachricht');
    });
    $('#map-load').addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = 'https://www.google.com/maps?q=Crea-Glass%20GmbH%2C%20Eichzun%204%2C%203800%20Unterseen&output=embed&hl=de';
      frame.title = 'Karte: Crea-Glass GmbH, Eichzun 4, 3800 Unterseen'; frame.loading = 'lazy'; frame.referrerPolicy = 'no-referrer-when-downgrade';
      $('#map').replaceChildren(frame);
    });
  }

  /* ---------- Start ---------- */
  $('#hero-count').textContent = String(products.filter(p => !p.sold).length);
  renderHighlights();
  renderRooms();
  renderRecent();
  setupHeader();
  setupParallax();
  setupContactForm();
  renderServiceSection();
  $('#visit-general').addEventListener('click', () => beginInquiry('visit'));
  $('#product-visit').addEventListener('click', () => beginInquiry('visit', activeProduct));
  $('#product-offer').addEventListener('click', () => beginInquiry(activeProduct && activeProduct.priceBasis === 'on_request' ? 'pickup' : (location ? 'install' : 'delivery'), activeProduct));
  $('#dialog-share').addEventListener('click', shareProduct);
  $('#dialog-cart').addEventListener('click', () => { if (activeProduct) feedback(`${activeProduct.code} wird im Crea-Glass Shop in den Warenkorb gelegt`); });
  for (const id of ['inquiry-purpose','inquiry-project','inquiry-time']) $('#'+id).addEventListener('input', updateInquiryLinks);
  $('#inquiry-purpose').addEventListener('change', updateInquiryLinks);
  $('#inquiry-location').addEventListener('change', handleInquiryLocation);
  $('#inquiry-location').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); handleInquiryLocation(); } });
  $('#inquiry-locate').addEventListener('click', () => handleLocate($('#inquiry-location-status'), $('#inquiry-location')));
  $('#location-form').addEventListener('submit', handleLocationForm);
  $('#locate-button').addEventListener('click', () => handleLocate($('#location-status'), $('#location-input')));
  $('#service-to-shortlist').addEventListener('click', () => beginInquiry('install'));
  $('#image-zoom').addEventListener('click', () => { $('#zoom-image').src = activeProduct.image; $('#zoom-image').alt = `${activeProduct.code} – ${activeProduct.title}`; $('#zoom-dialog').showModal(); });
  $('#zoom-close').addEventListener('click', () => $('#zoom-dialog').close());
  search.addEventListener('input', () => { limit = 24; render(); });
  for (const control of [availability, sort, priceMax]) control.addEventListener('change', () => { limit = 24; render(); });
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#empty-reset').addEventListener('click', clearFilters);
  $('#load-more').addEventListener('click', () => { limit += 24; render(); });
  $('#dialog-close').addEventListener('click', closeProductDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeProductDialog(); });
  dialog.addEventListener('close', () => setProductHash(null));
  $('#dialog-save').addEventListener('click', () => { if (activeProduct) toggleShortlist(activeProduct); });
  $('#open-shortlist').addEventListener('click', openShortlist);
  $('#shortlist-close').addEventListener('click', () => shortlistDialog.close());
  shortlistDialog.addEventListener('click', event => { if (event.target === shortlistDialog) shortlistDialog.close(); });
  window.addEventListener('hashchange', () => { const product = productFromLocation(); if (product) openProduct(product, {fromLocation:true}); else if (dialog.open) closeProductDialog(); });
  observeReveal(document.querySelectorAll('.reveal'));
  updateShortlistUI();
  render();
  let lastPreview = groupPreview();
  window.addEventListener('resize', () => { if (groupPreview() !== lastPreview) { lastPreview = groupPreview(); if (groupedMode()) render(); } });
  const initial = productFromLocation();
  if (initial) openProduct(initial, {fromLocation:true});
})();
