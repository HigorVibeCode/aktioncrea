(() => {
  const categoryOverrides = {'BA-06':'Glaswaschtische','BA-W':'Glaswaschtische','BA-05':'Glaswaschtische','BA-03':'Glaswaschtische','BA-M4':'Glaswaschtische','BA-RD':'Duschen','BA-ED':'Duschen','BA-FD':'Duschen','BA-SD':'Duschen','BA-D':'Glastüren','BA-P':'Glastüren','DIV 04':'Tische & Möbel'};
  const products = (window.CREA_CATALOG || []).map(product => ({...product, category: categoryOverrides[product.code] || product.category}));
  const service = window.CreaService;
  const SALE = 'Ausstellungsverkauf November 2026';
  const WHATSAPP = '41794152056';
  const EMAIL = 'verkauf@crea-glass.ch';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let feedbackTimer;
  const $ = selector => document.querySelector(selector);
  const grid = $('#product-grid');
  const search = $('#search');
  const availability = $('#availability');
  const sort = $('#sort');
  const categoryList = $('#category-list');
  const dialog = $('#product-dialog');
  const shortlistDialog = $('#shortlist-dialog');
  const shortlistKey = 'crea_glass_shortlist_v1';
  const locationKey = 'crea_glass_location_v1';
  let shortlist = new Set();
  let activeProduct = null;
  let location = null; // {lat, lon, label, km, estimated}
  try {
    const stored = JSON.parse(localStorage.getItem(shortlistKey) || '[]');
    if (Array.isArray(stored)) shortlist = new Set(stored.filter(id => products.some(product => product.id === id && !product.sold)));
    const storedLocation = JSON.parse(localStorage.getItem(locationKey) || 'null');
    if (storedLocation && Number.isFinite(storedLocation.km)) location = storedLocation;
  } catch (_) { /* Privater Modus kann Speicher sperren. Die Seite funktioniert trotzdem. */ }
  const categories = ['Alle', 'Neue Glasplatten', 'Glastrennwände', 'Glastüren', 'Glaswaschtische', 'Duschen', 'Spiegel', 'Glasbilder', 'Tische & Möbel', 'Zubehör'];
  let category = 'Alle';
  let application = null;
  let limit = 24;

  const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase();
  const money = value => `CHF ${new Intl.NumberFormat('de-CH', {maximumFractionDigits:0}).format(value)}.–`;
  const moneyRange = (a, b) => a === b ? money(a) : `CHF ${new Intl.NumberFormat('de-CH', {maximumFractionDigits:0}).format(a)}–${new Intl.NumberFormat('de-CH', {maximumFractionDigits:0}).format(b)}.–`;
  const hours = value => String(value).replace('.', ',');
  const statusLabel = product => product.sold ? 'Verkauft' : 'Neu · ab Werk';

  function priceInfo(product) {
    if (product.sold) return {value:'Verkauft', caption:'Im Katalog dokumentiert'};
    if (product.priceBasis === 'on_request') return {value:'Preis auf Anfrage', caption:'Offerte nach Mass und Einsatz'};
    return {
      value:money(product.displayPrice),
      caption:product.priceBasis === 'confirmed_november_2026' ? 'Aktionspreis November 2026' : 'Katalogpreis · aktuell bestätigen'
    };
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

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

  /* ---------- Anfragekorb ---------- */
  function saveShortlist() {
    try { localStorage.setItem(shortlistKey, JSON.stringify([...shortlist])); } catch (_) { /* Liste bleibt im Speicher. */ }
    updateShortlistUI();
  }

  function toggleShortlist(product) {
    if (product.sold) return;
    if (shortlist.has(product.id)) shortlist.delete(product.id);
    else shortlist.add(product.id);
    saveShortlist();
    feedback(shortlist.has(product.id) ? `${product.code} im Anfragekorb` : `${product.code} entfernt`);
  }

  function updateShortlistUI() {
    $('#shortlist-count').textContent = String(shortlist.size);
    $('#mobile-count').textContent = String(shortlist.size);
    for (const button of document.querySelectorAll('.save-button')) {
      const selected = shortlist.has(button.dataset.id);
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? '✓' : '+';
      button.setAttribute('aria-label', selected ? 'Aus Anfragekorb entfernen' : 'In den Anfragekorb legen');
    }
    const save = $('#dialog-save');
    if (activeProduct && !activeProduct.sold) {
      const selected = shortlist.has(activeProduct.id);
      save.setAttribute('aria-pressed', String(selected));
      save.textContent = selected ? '✓ Im Anfragekorb · entfernen' : '+ In den Anfragekorb';
    }
    if (shortlistDialog.open) renderShortlist();
  }

  const selectedProducts = () => products.filter(product => shortlist.has(product.id) && !product.sold);

  function renderShortlist() {
    const selected = selectedProducts();
    const container = $('#shortlist-items');
    container.replaceChildren();
    for (const product of selected) {
      const item = node('div', 'shortlist-item');
      const image = node('img');
      image.src = product.image;
      image.alt = product.title;
      image.loading = 'lazy';
      const details = node('div');
      details.append(node('strong', '', `${product.code} · ${product.title}`), node('span', '', `${priceInfo(product).value} · ${priceInfo(product).caption}`));
      const remove = node('button', '', 'Entfernen');
      remove.type = 'button';
      remove.setAttribute('aria-label', `${product.code} aus Anfragekorb entfernen`);
      remove.addEventListener('click', () => toggleShortlist(product));
      item.append(image, details, remove);
      container.append(item);
    }
    if (!selected.length) container.append(node('p', 'shortlist-empty', 'Ihr Anfragekorb ist leer. Wählen Sie Stücke im Katalog aus oder fragen Sie einen Beratungstermin ohne Vorauswahl an.'));
    updateInquiryLinks();
  }

  function openShortlist() {
    renderShortlist();
    if (!shortlistDialog.open) shortlistDialog.showModal();
  }

  /* ---------- Katalog ---------- */
  function renderCategories() {
    categoryList.replaceChildren();
    for (const name of categories) {
      const count = name === 'Alle' ? products.length : products.filter(product => product.category === name).length;
      const button = node('button', '', name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === name));
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
    const selected = products.filter(product => {
      if (category !== 'Alle' && product.category !== category) return false;
      if (application && !application.categories.includes(product.category)) return false;
      if (status === 'available' && product.sold) return false;
      if (status === 'sold' && !product.sold) return false;
      if (exactCode) return product.id === exactCode.id;
      const haystack = normalize([product.code, product.title, product.tagline, product.description, product.category, product.saleNote].join(' '));
      return words.every(word => haystack.includes(word));
    });
    const order = sort.value;
    if (order === 'code') selected.sort((a,b) => a.code.localeCompare(b.code, 'de-CH', {numeric:true}));
    if (order === 'price-asc' || order === 'price-desc') selected.sort((a,b) => {
      const ap = a.sold || a.displayPrice == null ? Infinity : a.displayPrice;
      const bp = b.sold || b.displayPrice == null ? Infinity : b.displayPrice;
      if (ap === Infinity && bp === Infinity) return a.code.localeCompare(b.code, 'de-CH', {numeric:true});
      if (ap === Infinity) return 1;
      if (bp === Infinity) return -1;
      return order === 'price-asc' ? ap-bp : bp-ap;
    });
    if (order === 'featured') selected.sort((a,b) => Number(a.sold)-Number(b.sold) || Number(b.priceBasis === 'confirmed_november_2026')-Number(a.priceBasis === 'confirmed_november_2026'));
    return selected;
  }

  function card(product, index = 0) {
    const article = node('article', 'product-card reveal');
    article.dataset.productId = product.id;
    article.style.setProperty('--i', String(Math.min(index % 8, 7)));
    const imageBox = node('div', 'card-image');
    const image = node('img');
    image.src = product.image;
    image.alt = `${product.title} – ${product.code}`;
    image.width = 1024; image.height = 1024; image.loading = 'lazy'; image.decoding = 'async';
    fadeImage(image);
    const imageLink = node('button', 'image-link');
    imageLink.type = 'button';
    imageLink.setAttribute('aria-label', `Details ansehen: ${product.code}`);
    imageLink.append(image);
    imageLink.addEventListener('click', () => openProduct(product));
    imageBox.append(imageLink, node('span', `status-pill${product.sold ? ' sold' : ''}`, statusLabel(product)));
    if (!product.sold) {
      const save = node('button', 'save-button', shortlist.has(product.id) ? '✓' : '+');
      save.type = 'button';
      save.dataset.id = product.id;
      save.setAttribute('aria-pressed', String(shortlist.has(product.id)));
      save.setAttribute('aria-label', shortlist.has(product.id) ? 'Aus Anfragekorb entfernen' : 'In den Anfragekorb legen');
      save.addEventListener('click', () => toggleShortlist(product));
      imageBox.append(save);
    }
    const body = node('div', 'card-body');
    const meta = node('div', 'card-meta');
    meta.append(node('span', '', product.code), node('span', '', product.category));
    const title = node('h3', 'card-title');
    const titleLink = node('button', 'title-link', product.title);
    titleLink.type = 'button';
    titleLink.addEventListener('click', () => openProduct(product));
    title.append(titleLink);
    const tagline = node('p', 'card-tagline', product.tagline || '');
    const description = node('p', 'card-description', product.description);
    const info = priceInfo(product);
    const price = node('div', `card-price${product.sold ? ' sold' : ''}`);
    price.append(node('strong', '', info.value), node('small', '', info.caption));
    const more = node('button', 'card-more', product.sold ? 'Ähnliche Stücke finden' : 'Details, Lieferung & Montage');
    more.type = 'button';
    more.setAttribute('aria-label', `Mehr erfahren: ${product.code} ${product.title}`);
    more.append(node('span', '', '↗'));
    more.addEventListener('click', () => openProduct(product));
    body.append(meta, title, tagline, description, price, more);
    article.append(imageBox, body);
    return article;
  }

  function render() {
    renderCategories();
    $('#application-context').hidden = !application;
    $('#application-context').textContent = application ? `Auswahl für: ${application.title} · Filter zurücksetzen zeigt alle Stücke.` : '';
    const list = filteredProducts();
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'Stück' : 'Stücke'} gefunden`;
    $('#empty-state').hidden = list.length > 0;
    const shown = list.slice(0, limit);
    const fragment = document.createDocumentFragment();
    shown.forEach((product, index) => fragment.append(card(product, index)));
    grid.replaceChildren(fragment);
    observeReveal(grid.querySelectorAll('.reveal'));
    const more = $('#load-more');
    more.hidden = shown.length >= list.length;
    more.textContent = `Weitere Stücke anzeigen (${list.length - shown.length}) `;
    more.append(node('span', '', '↓'));
  }

  /* ---------- Produktdialog & Links pro Stück ---------- */
  const productUrl = product => `${window.location.origin}${window.location.pathname}#artikel/${product.id}`;

  function productFromLocation() {
    const hash = decodeURIComponent(window.location.hash || '');
    const match = hash.match(/^#artikel\/(.+)$/) || (new URLSearchParams(window.location.search).get('artikel') ? [null, new URLSearchParams(window.location.search).get('artikel')] : null);
    if (!match) return null;
    const key = normalize(match[1]).replace(/[^a-z0-9]/g, '');
    return products.find(product => product.id === match[1]) || products.find(product => normalize(product.code).replace(/[^a-z0-9]/g, '') === key) || null;
  }

  function setProductHash(product) {
    const url = product ? `#artikel/${product.id}` : `${window.location.pathname}${window.location.search}`;
    if (product ? window.location.hash !== url : window.location.hash) history.replaceState(null, '', url);
  }

  function openProduct(product, {fromLocation = false} = {}) {
    activeProduct = product;
    const image = $('#dialog-image');
    image.classList.remove('is-loaded');
    image.src = product.image;
    image.alt = `${product.title} – ${product.description}`;
    fadeImage(image);
    $('#dialog-category').textContent = product.category;
    $('#dialog-code').textContent = `ARTIKELCODE ${product.code}`;
    $('#dialog-title').textContent = product.title;
    $('#dialog-tagline').textContent = product.tagline || '';
    $('#dialog-tagline').hidden = !product.tagline;
    $('#dialog-description').textContent = product.description;
    const status = $('#dialog-status');
    status.textContent = statusLabel(product);
    status.classList.toggle('sold', product.sold);
    const prices = $('#dialog-prices');
    prices.replaceChildren();
    let heading;
    if (product.sold) heading = 'Letzter Katalogpreis';
    else if (product.priceBasis === 'confirmed_november_2026') heading = 'Aktionspreis · November 2026';
    else if (product.priceBasis === 'on_request') heading = 'Preis auf Anfrage';
    else heading = 'Katalogpreis';
    prices.append(node('p', 'dialog-price-title', heading));
    if (product.prices.length) {
      for (const row of product.prices) {
        const item = node('div', 'dialog-price-row');
        item.append(node('span', '', row.label), node('strong', '', money(row.value)));
        prices.append(item);
      }
    } else {
      prices.append(node('p', 'dialog-description', 'Wir offerieren dieses Stück nach Mass und Einsatz. Fragen Sie mit dem Artikelcode an.'));
    }
    const notes = [];
    if (product.saleNote) notes.push(product.saleNote);
    if (product.sold) notes.push('Dieses Stück ist verkauft. Fragen Sie uns nach ähnlichen Artikeln oder einer Neuanfertigung.');
    else if (product.priceBasis === 'reference_may_2025') notes.push('Neu und unbenutzt, aus unserer Ausstellung. Richtwert aus dem Katalog (Stand 05/2025); den aktuellen Preis bestätigen wir mit Ihrer Anfrage.');
    else if (product.priceBasis === 'confirmed_november_2026') notes.push('Neu und unbenutzt, aus unserer Ausstellung. Aktionspreis gültig im November 2026, solange verfügbar.');
    else notes.push('Neu und unbenutzt, aus unserer Ausstellung.');
    $('#dialog-note').textContent = notes.join(' ');
    renderDialogService(product);
    const inquiry = product.sold
      ? `Guten Tag, ${product.code} ist verkauft. Haben Sie ein ähnliches Stück oder fertigen Sie es neu an?`
      : `Guten Tag, ich interessiere mich für ${product.code} (${product.title}) aus dem ${SALE}. Bitte teilen Sie mir den aktuellen Preis und die Verfügbarkeit mit.\n${productUrl(product)}`;
    $('#dialog-whatsapp').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(inquiry)}`;
    $('#dialog-email').href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Anfrage ${product.code} – ${SALE}`)}&body=${encodeURIComponent(inquiry)}`;
    $('#dialog-save').hidden = product.sold;
    updateShortlistUI();
    $('.dialog-contact p').textContent = product.sold ? 'Ähnliches Stück anfragen' : 'Mit diesem Artikelcode anfragen';
    updateProductNavigation(product);
    $('#product-visit').hidden = product.sold;
    $('#product-offer').hidden = product.sold;
    if (!fromLocation) setProductHash(product);
    if (!dialog.open) dialog.showModal();
    $('.dialog-content').scrollTop = 0;
  }

  function renderDialogService(product) {
    const box = $('#dialog-service');
    box.replaceChildren();
    if (!service || product.sold) return;
    const hint = service.productHint(product);
    if (!hint) return;
    box.append(node('p', 'dialog-price-title', 'Lieferung & Montage'));
    const list = node('ul', 'service-hint-list');
    const li1 = node('li'); li1.append(node('span', '', 'Abholung ab Werk'), node('strong', '', 'kostenlos'));
    const li2 = node('li'); li2.append(node('span', '', 'Lieferung'), node('strong', '', hint.delivery));
    const li3 = node('li'); li3.append(node('span', '', `Montage ca. ${hours(hint.hours[0])}–${hours(hint.hours[1])} h`), node('strong', '', `${moneyRange(hint.priceRange[0], hint.priceRange[1])} zzgl. Anfahrt`));
    list.append(li1, li2, li3);
    box.append(list);
    if (hint.note) box.append(node('p', 'dialog-note', hint.note));
    const button = node('button', 'service-link', 'Richtpreis für meinen Standort berechnen ↗');
    button.type = 'button';
    button.addEventListener('click', () => beginInquiry('install', product));
    box.append(button);
  }

  async function shareProduct() {
    if (!activeProduct) return;
    const url = productUrl(activeProduct);
    const data = {title: `${activeProduct.code} · ${activeProduct.title}`, text: `${activeProduct.title} – Crea-Glass ${SALE}`, url};
    try {
      if (navigator.share && navigator.canShare?.(data)) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      feedback('Link kopiert');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      window.prompt('Link zu diesem Stück kopieren:', url);
    }
  }

  function closeProductDialog() {
    if (dialog.open) dialog.close();
  }

  function clearFilters() {
    search.value = '';
    availability.value = 'all';
    sort.value = 'featured';
    category = 'Alle'; application = null; limit = 24; render();
  }

  const applications = [
    {title:'Bad & Wellness', caption:'Waschtische, Duschen und Spiegel', categories:['Glaswaschtische','Duschen','Spiegel'], idea:'Idee fürs Bad: Bringen Sie ein Foto und die verfügbaren Masse mit. Anschlüsse und Einbausituation prüfen wir vor der Entscheidung.'},
    {title:'Räume verbinden', caption:'Glastüren und Trennwände', categories:['Glastüren','Glastrennwände'], idea:'Idee für Ihren Grundriss: Vergleichen Sie Lichtwirkung und Privatsphäre. Glasart, Beschläge und Einbaumasse müssen zu Ihrer Anwendung passen.'},
    {title:'Wohnen & Akzente', caption:'Tische, Möbel und Glasbilder', categories:['Tische & Möbel','Glasbilder'], idea:'Idee für Ihren Wohnraum: Prüfen Sie Proportionen, Farbe und Oberfläche im Zusammenspiel mit Ihren Möbeln. Raumfotos helfen bei der Auswahl.'},
    {title:'Struktur & Licht', caption:'Neue dekorative Glasplatten', categories:['Neue Glasplatten'], idea:'Inspiration: Strukturglas als gestalterischer Akzent. Die gezeigte Lichtwirkung hängt von der Beleuchtung ab; Zubehörumfang und technische Eignung bitte klären.'}
  ];

  /* ---------- Standort, Zone und Richtpreis ---------- */
  function saveLocation() {
    try { if (location) localStorage.setItem(locationKey, JSON.stringify(location)); else localStorage.removeItem(locationKey); } catch (_) { /* optional */ }
  }

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

  function describeStatus(statusElement, error) {
    statusElement.textContent = error.message || 'Standort nicht gefunden.';
    statusElement.classList.add('is-error');
  }

  function renderServiceSection() {
    if (!service) { $('#service').hidden = true; return; }
    const tariff = service.TARIFF;
    const fmt = value => new Intl.NumberFormat('de-CH', {maximumFractionDigits:0}).format(value);
    document.querySelectorAll('[data-tariff="delivery-a"]').forEach(el => el.textContent = fmt(tariff.zones[0].delivery));
    document.querySelectorAll('[data-tariff="free-from"]').forEach(el => el.textContent = fmt(tariff.freeDeliveryFrom));
    document.querySelectorAll('[data-tariff="rate"]').forEach(el => el.textContent = fmt(tariff.hourlyRate));
    const zones = $('#service-zones');
    zones.replaceChildren(node('p', 'dialog-price-title', 'Zonen ab Werk Unterseen'));
    const table = node('table', 'zone-table');
    const head = node('tr'); ['Zone', 'Lieferung', 'Anfahrt Montage'].forEach(text => head.append(node('th', '', text)));
    table.append(head);
    for (const zone of tariff.zones) {
      const row = node('tr');
      const first = node('td'); first.append(node('strong', '', zone.label), node('small', '', zone.area));
      row.append(first, node('td', '', zone.delivery == null ? 'Offerte' : money(zone.delivery)), node('td', '', zone.travel == null ? 'Offerte' : zone.travel === 0 ? 'inbegriffen' : money(zone.travel)));
      table.append(row);
    }
    zones.append(table, node('p', 'service-footnote', `Lieferung gratis ab ${money(tariff.freeDeliveryFrom)} Warenwert in den Zonen A–C. Bei Montage ist die Lieferung immer inbegriffen. Kleines Zubehör versenden wir per Post für ${money(tariff.postalShipping)}.`));
    if (location) { $('#location-input').value = location.label; renderServiceResult(); $('#location-status').textContent = `${location.label} · ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km ab Werk`; }
  }

  function renderServiceResult() {
    const result = $('#service-result');
    if (!location) { result.hidden = true; return; }
    const zone = service.zoneFor(location.km);
    $('#service-zone-label').textContent = zone.label;
    $('#service-distance').textContent = `${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km ab Werk · ${location.label}`;
    const options = $('#service-options');
    options.replaceChildren();
    const selected = selectedProducts();
    const tariff = service.TARIFF;
    const option = (title, value, caption) => {
      const box = node('div', 'service-option');
      box.append(node('span', 'service-option-title', title), node('strong', '', value), node('small', '', caption));
      return box;
    };
    options.append(option('Abholung ab Werk', 'kostenlos', 'Eichzun 4, Unterseen · nach Terminabsprache'));
    if (zone.delivery == null) options.append(option('Lieferung', 'Offerte', 'Ausserhalb der Lieferzonen – wir offerieren individuell'));
    else {
      const delivery = selected.length ? service.estimate(selected, 'delivery', location.km) : null;
      const value = delivery ? (delivery.total === 0 ? 'gratis' : money(delivery.total)) : money(zone.delivery);
      options.append(option('Lieferung ohne Montage', value, delivery && delivery.total === 0 && delivery.value >= tariff.freeDeliveryFrom ? `Ihre Auswahl liegt über ${money(tariff.freeDeliveryFrom)} Warenwert` : `Pro Auftrag · gratis ab ${money(tariff.freeDeliveryFrom)} Warenwert`));
    }
    if (zone.travel == null) options.append(option('Lieferung + Montage', 'Offerte', 'Ausserhalb der Montagezonen – wir offerieren individuell'));
    else {
      const install = selected.length ? service.estimate(selected, 'install', location.km) : null;
      if (install && !install.onRequest) options.append(option('Lieferung + Montage', moneyRange(install.total, install.totalMax), `Ihre ${install.items} ${install.items === 1 ? 'Stück' : 'Stücke'} · ${hours(install.hours[0])}–${hours(install.hours[1])} h Montage · Anfahrt ${zone.travel ? money(zone.travel) : 'inbegriffen'}`));
      else options.append(option('Lieferung + Montage', `${zone.travel ? money(zone.travel) + ' + ' : ''}${money(tariff.hourlyRate)}/h`, 'Lieferung inbegriffen · Montagezeit je nach Stück, siehe Produktdetails'));
    }
    $('#service-to-shortlist').textContent = selected.length ? 'Anfrage mit Richtpreis senden ↗' : 'Stücke auswählen und berechnen ↗';
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
    const box = $('#inquiry-estimate');
    box.replaceChildren();
    const estimate = currentEstimate();
    if (!estimate || block.hidden) { box.hidden = true; return; }
    if (!estimate.items) { box.append(node('p', '', 'Legen Sie Stücke in den Anfragekorb, um den Richtpreis zu sehen.')); box.hidden = false; return; }
    if (!location) { box.append(node('p', '', 'Standort eingeben, um Zone und Richtpreis zu sehen.')); box.hidden = false; return; }
    box.append(node('p', 'dialog-price-title', `${estimate.zone.label} · ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km`));
    for (const line of estimate.lines) {
      const row = node('div', 'dialog-price-row');
      const value = line.valueMax != null && line.valueMax !== line.value ? moneyRange(line.value, line.valueMax) : line.value === 0 ? 'inbegriffen' : money(line.value);
      const strong = node('strong', line.strike ? 'is-strike' : '', value);
      row.append(node('span', '', line.label), strong);
      box.append(row);
    }
    if (estimate.onRequest) box.append(node('p', '', 'Individuelle Offerte – wir melden uns mit dem Preis.'));
    else {
      const total = node('div', 'dialog-price-row is-total');
      total.append(node('span', '', estimate.mode === 'install' ? 'Richtpreis Lieferung + Montage' : 'Richtpreis Lieferung'), node('strong', '', estimate.total === 0 ? 'gratis' : moneyRange(estimate.total, estimate.totalMax)));
      box.append(total);
    }
    for (const note of estimate.notes) box.append(node('p', 'dialog-note', note));
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
    const intro = {
      visit: 'ich möchte einen Besuch im Showroom in Unterseen anfragen.',
      pickup: 'ich möchte folgende Stücke ab Werk in Unterseen abholen und bitte um Bestätigung von Preis und Verfügbarkeit.',
      delivery: 'ich möchte folgende Stücke geliefert bekommen und bitte um ein Angebot.',
      install: 'ich möchte folgende Stücke geliefert und montiert bekommen und bitte um ein Angebot.'
    }[purpose];
    const lines = ['Guten Tag,', intro];
    if (selected.length) lines.push('Meine Auswahl:', ...selected.map(p => `${p.code} – ${p.title} (${priceInfo(p).value}; ${priceInfo(p).caption})`));
    const estimate = currentEstimate();
    if (estimate && estimate.items && location && (purpose === 'delivery' || purpose === 'install')) {
      lines.push(`Lieferort: ${location.label} (${estimate.zone.label}, ${location.estimated ? 'ca. ' : ''}${Math.round(location.km)} km)`);
      if (estimate.onRequest) lines.push('Richtpreis: individuelle Offerte');
      else if (purpose === 'install') lines.push(`Richtpreis Lieferung + Montage laut Website: ${moneyRange(estimate.total, estimate.totalMax)} (Montage ${hours(estimate.hours[0])}–${hours(estimate.hours[1])} h × CHF ${service.TARIFF.hourlyRate}${estimate.zone.travel ? `, Anfahrt CHF ${estimate.zone.travel}` : ''})`);
      else lines.push(`Richtpreis Lieferung laut Website: ${estimate.total === 0 ? 'gratis' : money(estimate.total)}`);
    }
    if (project) lines.push(`Mein Projekt: ${project}`);
    if (visit && time) lines.push(`Mein Wunschtermin: ${time}`);
    lines.push({
      visit: 'Bitte bestätigen Sie mir einen Termin sowie die Verfügbarkeit meiner Auswahl.',
      pickup: 'Bitte bestätigen Sie mir Preis, Verfügbarkeit und einen Abholtermin.',
      delivery: 'Bitte bestätigen Sie mir Preis, Lieferkosten und einen Liefertermin.',
      install: 'Bitte bestätigen Sie mir Preis, Montageumfang und einen Montagetermin.'
    }[purpose]);
    const message = lines.join('\n');
    const label = {visit: 'Besuch', pickup: 'Abholung', delivery: 'Lieferung', install: 'Montage'}[purpose];
    $('#shortlist-whatsapp').textContent = `${label} per WhatsApp anfragen ↗`;
    $('#shortlist-email').textContent = `${label} per E-Mail anfragen ↗`;
    $('#shortlist-whatsapp').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
    $('#shortlist-email').href = `mailto:${EMAIL}?subject=${encodeURIComponent(`${label} – ${SALE}`)}&body=${encodeURIComponent(message)}`;
    $('#inquiry-explanation').textContent = visit
      ? 'Wir bestätigen Termin, Preis und Verfügbarkeit persönlich. Ihre Auswahl ist noch keine Reservierung oder Bestellung.'
      : 'Richtpreise laut Website. Wir bestätigen Preis, Umfang und Termin persönlich. Diese Anfrage löst noch keine Bestellung oder Zahlung aus.';
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
    const status = $('#inquiry-location-status');
    const value = $('#inquiry-location').value.trim();
    if (!value) return;
    try { await resolveLocation(value, status); $('#location-input').value = location.label; renderServiceResult(); updateInquiryLinks(); }
    catch (error) { describeStatus(status, error); }
  }

  /* ---------- Navigation im Dialog ---------- */
  function navigationProducts() {
    const list = filteredProducts();
    return activeProduct && list.some(p => p.id === activeProduct.id) ? list : products;
  }

  function updateProductNavigation(product) {
    const list = navigationProducts();
    const index = list.findIndex(p => p.id === product.id);
    $('#product-position').textContent = `${index + 1} / ${list.length}`;
    $('#product-prev').disabled = index <= 0;
    $('#product-next').disabled = index >= list.length - 1;
    const group = applications.find(a => a.categories.includes(product.category));
    $('#application-idea').textContent = group?.idea || 'Bringen Sie Ihre Projektmasse mit. Wir klären gemeinsam, ob dieses Stück zu Ihrem Vorhaben passt.';
    const related = $('#related-products'); related.replaceChildren();
    const alternatives = products.filter(p => p.category === product.category && p.id !== product.id && !p.sold).slice(0,3);
    if (alternatives.length) related.append(node('h3', '', product.sold ? 'Verfügbare Alternativen entdecken' : 'Auch einen Blick wert'));
    for (const p of alternatives) {
      const button = node('button', 'related-item'); button.type = 'button';
      const img = node('img'); img.src = p.image; img.alt = ''; img.loading = 'lazy';
      button.append(img, node('span','',`${p.code} · ${p.title}`));
      button.addEventListener('click', () => openProduct(p));
      related.append(button);
    }
  }

  /* ---------- Bewegung & Navigation ---------- */
  const revealObserver = ('IntersectionObserver' in window && !reducedMotion) ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('in-view'); revealObserver.unobserve(entry.target); }
  }, {rootMargin: '0px 0px -8% 0px', threshold: 0.08}) : null;

  function observeReveal(elements) {
    for (const element of elements) {
      if (!revealObserver) { element.classList.add('in-view'); continue; }
      revealObserver.observe(element);
    }
  }

  function setupHeader() {
    const header = $('#site-header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
    const links = [...document.querySelectorAll('.main-nav a[data-section]')];
    if (!('IntersectionObserver' in window)) return;
    const sections = links.map(link => document.getElementById(link.dataset.section)).filter(Boolean);
    const sectionObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      for (const link of links) {
        if (link.dataset.section === visible.target.id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      }
    }, {rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.3]});
    sections.forEach(section => sectionObserver.observe(section));
  }

  /* ---------- Start ---------- */
  for (const group of applications) {
    const button = node('button','application-card'); button.type = 'button';
    button.append(node('strong','',group.title), node('span','',group.caption), node('b','','Entdecken →'));
    button.addEventListener('click', () => { category = 'Alle'; application = group; search.value = ''; availability.value = 'available'; limit = 24; render(); $('#katalog').scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth'}); });
    $('#application-grid').append(button);
  }
  products.filter(p => !p.sold && p.priceBasis === 'confirmed_november_2026').forEach((p, i) => $('#featured-grid').append(card(p, i)));
  $('#product-prev').addEventListener('click', () => { const list = navigationProducts(); const i = list.findIndex(p => p.id === activeProduct.id); if(i > 0) openProduct(list[i-1]); });
  $('#product-next').addEventListener('click', () => { const list = navigationProducts(); const i = list.findIndex(p => p.id === activeProduct.id); if(i < list.length-1) openProduct(list[i+1]); });
  $('#visit-general').addEventListener('click', () => beginInquiry('visit'));
  $('#product-visit').addEventListener('click', () => beginInquiry('visit', activeProduct));
  $('#product-offer').addEventListener('click', () => beginInquiry(location ? 'install' : 'delivery', activeProduct));
  $('#dialog-share').addEventListener('click', shareProduct);
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
  availability.addEventListener('change', () => { limit = 24; render(); });
  sort.addEventListener('change', () => { limit = 24; render(); });
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#empty-reset').addEventListener('click', clearFilters);
  $('#load-more').addEventListener('click', () => { limit += 24; render(); });
  $('#dialog-close').addEventListener('click', closeProductDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeProductDialog(); });
  dialog.addEventListener('close', () => { setProductHash(null); });
  $('#dialog-save').addEventListener('click', () => { if (activeProduct) toggleShortlist(activeProduct); });
  $('#open-shortlist').addEventListener('click', openShortlist);
  $('#mobile-shortlist').addEventListener('click', openShortlist);
  $('#shortlist-close').addEventListener('click', () => shortlistDialog.close());
  shortlistDialog.addEventListener('click', event => { if (event.target === shortlistDialog) shortlistDialog.close(); });
  window.addEventListener('hashchange', () => { const product = productFromLocation(); if (product) openProduct(product, {fromLocation:true}); else if (dialog.open) closeProductDialog(); });

  observeReveal(document.querySelectorAll('.reveal'));
  setupHeader();
  renderServiceSection();
  updateShortlistUI();
  render();
  const initial = productFromLocation();
  if (initial) openProduct(initial, {fromLocation:true});
})();
