(() => {
  const products = window.CREA_CATALOG || [];
  const $ = selector => document.querySelector(selector);
  const grid = $('#product-grid');
  const search = $('#search');
  const availability = $('#availability');
  const sort = $('#sort');
  const categoryList = $('#category-list');
  const dialog = $('#product-dialog');
  const categories = ['Alle', 'Neue Glasplatten', 'Glastrennwände', 'Glastüren', 'Glaswaschtische', 'Ausstellungsstücke', 'Duschen', 'Spiegel', 'Glasbilder', 'Tische & Möbel', 'Zubehör'];
  let category = 'Alle';
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

  function renderCategories() {
    categoryList.replaceChildren();
    for (const name of categories) {
      const count = name === 'Alle' ? products.length : products.filter(product => product.category === name).length;
      const button = node('button', '', name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category === name));
      const amount = node('small', '', String(count));
      button.append(amount);
      button.addEventListener('click', () => { category = name; limit = 24; render(); });
      categoryList.append(button);
    }
  }

  function filteredProducts() {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    const status = availability.value;
    const selected = products.filter(product => {
      if (category !== 'Alle' && product.category !== category) return false;
      if (status === 'available' && product.sold) return false;
      if (status === 'sold' && !product.sold) return false;
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
    if (order === 'featured') selected.sort((a,b) => Number(a.sold)-Number(b.sold));
    return selected;
  }

  function card(product) {
    const article = node('article', 'product-card');
    article.id = `produkt-${product.id}`;
    const imageBox = node('div', 'card-image');
    const image = node('img');
    image.src = product.image;
    image.alt = `${product.title} – ${product.code}`;
    image.width = 1024; image.height = 1024; image.loading = 'lazy'; image.decoding = 'async';
    imageBox.append(image, node('span', `status-pill${product.sold ? ' sold' : ''}`, statusLabel(product)));
    const body = node('div', 'card-body');
    const meta = node('div', 'card-meta');
    meta.append(node('span', '', product.code), node('span', '', product.category));
    const title = node('h3', 'card-title', product.title);
    const description = node('p', 'card-description', product.description);
    const info = priceInfo(product);
    const price = node('div', `card-price${product.sold ? ' sold' : ''}`);
    price.append(node('strong', '', info.value), node('small', '', info.caption));
    const more = node('button', 'card-more', 'Mehr erfahren');
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
    $('.dialog-contact p').textContent = product.sold ? 'Ähnliches Stück anfragen' : 'Mit diesem Artikelcode anfragen';
    dialog.showModal();
  }

  function clearFilters() {
    search.value = '';
    availability.value = 'all';
    sort.value = 'featured';
    category = 'Alle'; limit = 24; render();
  }

  search.addEventListener('input', () => { limit = 24; render(); });
  availability.addEventListener('change', () => { limit = 24; render(); });
  sort.addEventListener('change', () => { limit = 24; render(); });
  $('#clear-filters').addEventListener('click', clearFilters);
  $('#empty-reset').addEventListener('click', clearFilters);
  $('#load-more').addEventListener('click', () => { limit += 24; render(); });
  $('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  render();
})();
