(() => {
  const products = window.CREA_CATALOG || [];
  const $ = selector => document.querySelector(selector);
  const grid = $('#product-grid');
  const search = $('#search');
  const availability = $('#availability');
  const sort = $('#sort');
  const categoryList = $('#category-list');
  const dialog = $('#product-dialog');
  const shortlistDialog = $('#shortlist-dialog');
  const shortlistKey = 'crea_glass_shortlist_v1';
  let shortlist = new Set();
  let activeProduct = null;
  try {
    const stored = JSON.parse(localStorage.getItem(shortlistKey) || '[]');
    if (Array.isArray(stored)) shortlist = new Set(stored.filter(id => products.some(product => product.id === id && !product.sold)));
  } catch (_) { /* Private browsing can disable storage. The list still works for this visit. */ }
  const categories = ['Alle', 'Neue Glasplatten', 'Glastrennwände', 'Glastüren', 'Glaswaschtische', 'Ausstellungsstücke', 'Duschen', 'Spiegel', 'Glasbilder', 'Tische & Möbel', 'Zubehör'];
  let category = 'Alle';
  let application = null;
  let limit = 24;

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLowerCase();
  const money = value => `CHF ${new Intl.NumberFormat('de-CH', {maximumFractionDigits:0}).format(value)}.–`;
  const statusLabel = product => product.sold ? 'Verkauft' : 'Sofort ab Werk';

  function priceInfo(product) {
    if (product.sold) return {value:'Verkauft', caption:'Zur Dokumentation im Katalog'};
    if (product.priceBasis === 'on_request') return {value:'Preis auf Anfrage', caption:'Aktuellen Preis anfragen'};
    return {
      value:money(product.displayPrice),
      caption:product.priceBasis === 'confirmed_november_2026' ? 'Aktionspreis November 2026' : 'Referenzpreis Mai 2025'
    };
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function saveShortlist() {
    try { localStorage.setItem(shortlistKey, JSON.stringify([...shortlist])); } catch (_) { /* Keep the in-memory list. */ }
    updateShortlistUI();
  }

  function toggleShortlist(product) {
    if (product.sold) return;
    if (shortlist.has(product.id)) shortlist.delete(product.id);
    else shortlist.add(product.id);
    saveShortlist();
    $('#selection-feedback').textContent = shortlist.has(product.id) ? `${product.code} im Anfragekorb` : `${product.code} entfernt`;
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

  function renderShortlist() {
    const selected = products.filter(product => shortlist.has(product.id) && !product.sold);
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
    shortlistDialog.showModal();
  }

  function renderCategories() {
    categoryList.replaceChildren();
    for (const name of categories) {
      const count = name === 'Alle' ? products.length : products.filter(product => product.category === name).length;
      const button = node('button', '', name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === name));
      const amount = node('small', '', String(count));
      button.append(amount);
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
      const haystack = normalize([product.code, product.title, product.description, product.category, product.saleNote].join(' '));
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

  function card(product) {
    const article = node('article', 'product-card');
    article.dataset.productId = product.id;
    const imageBox = node('div', 'card-image');
    const image = node('img');
    image.src = product.image;
    image.alt = `${product.title} – ${product.code}`;
    image.width = 1024; image.height = 1024; image.loading = 'lazy'; image.decoding = 'async';
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
    const description = node('p', 'card-description', product.description);
    const info = priceInfo(product);
    const price = node('div', `card-price${product.sold ? ' sold' : ''}`);
    price.append(node('strong', '', info.value), node('small', '', info.caption));
    const more = node('button', 'card-more', product.sold ? 'Ähnliche Stücke finden' : 'Details & Besichtigung');
    more.type = 'button';
    more.setAttribute('aria-label', `Mehr erfahren: ${product.code} ${product.title}`);
    more.append(node('span', '', '↗'));
    more.addEventListener('click', () => openProduct(product));
    body.append(meta, title, description, price, more);
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
    shown.forEach(product => fragment.append(card(product)));
    grid.replaceChildren(fragment);
    const more = $('#load-more');
    more.hidden = shown.length >= list.length;
    more.textContent = `Weitere Stücke anzeigen (${list.length - shown.length}) `;
    more.append(node('span', '', '↓'));
  }

  function openProduct(product) {
    activeProduct = product;
    $('#dialog-image').src = product.image;
    $('#dialog-image').alt = `${product.title} – ${product.description}`;
    $('#dialog-category').textContent = product.category;
    $('#dialog-code').textContent = `ARTIKELCODE ${product.code}`;
    $('#dialog-title').textContent = product.title;
    $('#dialog-description').textContent = product.description;
    const status = $('#dialog-status');
    status.textContent = statusLabel(product);
    status.classList.toggle('sold', product.sold);
    const prices = $('#dialog-prices');
    prices.replaceChildren();
    let heading;
    if (product.sold) heading = 'Letzte Katalogpreise · Mai 2025';
    else if (product.priceBasis === 'confirmed_november_2026') heading = 'Aktionspreis · November 2026';
    else if (product.priceBasis === 'on_request') heading = 'Preis auf Anfrage';
    else heading = 'Referenzpreis · Mai 2025';
    prices.append(node('p', 'dialog-price-title', heading));
    if (product.prices.length) {
      for (const row of product.prices) {
        const item = node('div', 'dialog-price-row');
        item.append(node('span', '', row.label), node('strong', '', money(row.value)));
        prices.append(item);
      }
    } else {
      prices.append(node('p', 'dialog-description', 'Bitte fragen Sie den aktuellen Preis mit dem Artikelcode an.'));
    }
    const notes = [];
    if (product.saleNote) notes.push(product.saleNote);
    if (product.sold) notes.push('Dieses Stück ist verkauft. Fragen Sie uns nach ähnlichen Artikeln.');
    else if (product.priceBasis === 'reference_may_2025') notes.push('Historischer Preis aus Mai 2025, kein bestätigter Novemberpreis. Bitte aktuellen Preis vor der Abholung anfragen.');
    else if (product.priceBasis === 'confirmed_november_2026') notes.push('Aktualisierter Aktionspreis. Bitte Verfügbarkeit vor der Abholung bestätigen.');
    $('#dialog-note').textContent = notes.join(' ');
    const inquiry = product.sold
      ? `Guten Tag, ${product.code} ist verkauft. Haben Sie ein ähnliches Stück?`
      : `Guten Tag, ich interessiere mich für ${product.code} (${product.title}) aus dem Lagerverkauf November 2026. Bitte teilen Sie mir den aktuellen Preis und die Verfügbarkeit mit.`;
    $('#dialog-whatsapp').href = `https://wa.me/41794152056?text=${encodeURIComponent(inquiry)}`;
    $('#dialog-email').href = `mailto:verkauf@crea.glass.ch?subject=${encodeURIComponent(`Anfrage ${product.code} – Lagerverkauf November 2026`)}&body=${encodeURIComponent(inquiry)}`;
    $('#dialog-save').hidden = product.sold;
    updateShortlistUI();
    $('.dialog-contact p').textContent = product.sold ? 'Ähnliches Stück anfragen' : 'Mit diesem Artikelcode anfragen';
    updateProductNavigation(product);
    $('#product-visit').hidden = product.sold;
    $('#product-offer').hidden = product.sold;
    if (!dialog.open) dialog.showModal();
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

  function updateInquiryLinks() {
    const selected = products.filter(p => shortlist.has(p.id) && !p.sold);
    const visit = $('#inquiry-purpose').value === 'visit';
    $('#visit-time-label').hidden = !visit;
    const project = $('#inquiry-project').value.trim();
    const time = $('#inquiry-time').value.trim();
    const lines = ['Guten Tag,', visit ? 'ich möchte einen Besuch im Showroom in Unterseen anfragen.' : 'ich möchte ein Angebot aus der Ferne erhalten.'];
    if (selected.length) lines.push('Meine Auswahl:', ...selected.map(p => `${p.code} – ${p.title} (${priceInfo(p).value}; ${priceInfo(p).caption})`));
    if (project) lines.push(`Mein Projekt: ${project}`);
    if (visit && time) lines.push(`Mein Wunschtermin: ${time}`);
    lines.push(visit ? 'Bitte bestätigen Sie mir einen Termin sowie die Verfügbarkeit meiner Auswahl.' : 'Bitte bestätigen Sie aktuelle Preise, Masse, Lieferumfang und die Möglichkeiten zur Abholung.');
    const message = lines.join('\n');
    $('#shortlist-whatsapp').textContent = visit ? 'Besuch per WhatsApp anfragen ↗' : 'Angebot per WhatsApp anfragen ↗';
    $('#shortlist-email').textContent = visit ? 'Besuch per E-Mail anfragen ↗' : 'Angebot per E-Mail anfragen ↗';
    $('#shortlist-whatsapp').href = `https://wa.me/41794152056?text=${encodeURIComponent(message)}`;
    $('#shortlist-email').href = `mailto:verkauf@crea.glass.ch?subject=${encodeURIComponent(visit ? 'Showroom-Besuch – November 2026' : 'Angebot – November 2026')}&body=${encodeURIComponent(message)}`;
    $('#inquiry-explanation').textContent = visit ? 'Wir bestätigen Termin, Preis und Verfügbarkeit persönlich. Ihre Auswahl ist noch keine Reservierung oder Bestellung.' : 'Wir klären Preis, Masse und Lieferumfang mit Ihnen. Diese Anfrage löst noch keine Bestellung oder Zahlung aus.';
  }

  function beginInquiry(purpose, product) {
    if (product && !product.sold) { shortlist.add(product.id); saveShortlist(); }
    $('#inquiry-purpose').value = purpose;
    if (dialog.open) dialog.close();
    openShortlist();
  }

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
      button.addEventListener('click', () => { openProduct(p); dialog.scrollTop = 0; $('.dialog-content').scrollTop = 0; });
      related.append(button);
    }
  }

  for (const group of applications) {
    const button = node('button','application-card'); button.type = 'button';
    button.append(node('strong','',group.title), node('span','',group.caption), node('b','','Entdecken →'));
    button.addEventListener('click', () => { category = 'Alle'; application = group; search.value = ''; availability.value = 'available'; limit = 24; render(); $('#katalog').scrollIntoView({behavior:'smooth'}); });
    $('#application-grid').append(button);
  }
  products.filter(p => !p.sold && p.priceBasis === 'confirmed_november_2026').forEach(p => $('#featured-grid').append(card(p)));
  $('#product-prev').addEventListener('click', () => { const list = navigationProducts(); const i = list.findIndex(p => p.id === activeProduct.id); if(i > 0) openProduct(list[i-1]); });
  $('#product-next').addEventListener('click', () => { const list = navigationProducts(); const i = list.findIndex(p => p.id === activeProduct.id); if(i < list.length-1) openProduct(list[i+1]); });
  $('#visit-general').addEventListener('click', () => beginInquiry('visit'));
  $('#product-visit').addEventListener('click', () => beginInquiry('visit', activeProduct));
  $('#product-offer').addEventListener('click', () => beginInquiry('offer', activeProduct));
  for (const id of ['inquiry-purpose','inquiry-project','inquiry-time']) $('#'+id).addEventListener('input', updateInquiryLinks);
  $('#image-zoom').addEventListener('click', () => { $('#zoom-image').src = activeProduct.image; $('#zoom-image').alt = `${activeProduct.code} – ${activeProduct.title}`; $('#zoom-dialog').showModal(); });
  $('#zoom-close').addEventListener('click', () => $('#zoom-dialog').close());

  search.addEventListener('input', () => { limit = 24; render(); });
  availability.addEventListener('change', () => { limit = 24; render(); });
  sort.addEventListener('change', () => { limit = 24; render(); });
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#empty-reset').addEventListener('click', clearFilters);
  $('#load-more').addEventListener('click', () => { limit += 24; render(); });
  $('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  $('#dialog-save').addEventListener('click', () => { if (activeProduct) toggleShortlist(activeProduct); });
  $('#open-shortlist').addEventListener('click', openShortlist);
  $('#mobile-shortlist').addEventListener('click', openShortlist);
  $('#shortlist-close').addEventListener('click', () => shortlistDialog.close());
  shortlistDialog.addEventListener('click', event => { if (event.target === shortlistDialog) shortlistDialog.close(); });
  updateShortlistUI();
  render();
})();
