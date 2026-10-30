/* Lieferung & Montage: Tarif, Standortsuche, Distanz und Richtpreis.
   Alle Beträge sind Vorschläge und werden von Crea-Glass vor Auftrag bestätigt.
   Tarif anpassen: nur das Objekt TARIFF ändern. */
(() => {
  const ORIGIN = {lat: 46.6895, lon: 7.8415, label: 'Eichzun 4, 3800 Unterseen'};

  const TARIFF = {
    hourlyRate: 220,            // CHF pro Stunde, Montageteam (2 Personen), inkl. Werkzeug
    freeDeliveryFrom: 3000,     // Lieferung ohne Montage gratis ab diesem Warenwert (Zonen A–C)
    postalShipping: 15,         // CHF, nur kleines Zubehör
    zones: [
      {key: 'A', maxKm: 15,  label: 'Zone A · bis 15 km',  delivery: 90,  travel: 0,   area: 'Interlaken, Matten, Wilderswil, Bönigen, Ringgenberg, Beatenberg'},
      {key: 'B', maxKm: 40,  label: 'Zone B · bis 40 km',  delivery: 160, travel: 120, area: 'Thun, Spiez, Brienz, Meiringen, Grindelwald, Lauterbrunnen, Frutigen'},
      {key: 'C', maxKm: 80,  label: 'Zone C · bis 80 km',  delivery: 260, travel: 240, area: 'Bern, Burgdorf, Luzern, Zweisimmen, Gstaad'},
      {key: 'D', maxKm: Infinity, label: 'Zone D · über 80 km', delivery: null, travel: null, area: 'Zürich, Basel, Romandie, Wallis – individuelle Offerte'}
    ]
  };

  /* Montagezeit pro Produktgruppe in Stunden [min, max], Team von 2 Personen. */
  const INSTALL = {
    'Glaswaschtische': product => /Unterschrank|Möbel|Komplettset|Seitenschrank|Holzsockel/i.test(product.title + ' ' + product.description) ? [3, 4] : [1.5, 2.5],
    'Duschen': () => [5, 8],
    'Glastüren': () => [2, 3],
    'Glastrennwände': () => [2, 4],
    'Neue Glasplatten': () => [2, 4],
    'Spiegel': product => /LED/i.test(product.title + ' ' + product.description) ? [1.5, 2] : [1, 1.5],
    'Glasbilder': () => [0.5, 1],
    'Tische & Möbel': () => [1, 2],
    'Zubehör': product => /Baranlage|Bartheke/i.test(product.title) ? [2, 3] : /Möbel|Badmöbel/i.test(product.title) ? [1, 1.5] : [0.5, 1]
  };
  const INSTALL_NOTE = {
    'Glaswaschtische': 'Montage des Waschtischs und der Möbel. Wasseranschluss durch Ihren Sanitär oder nach Absprache.',
    'Duschen': 'Montage der Gläser, Türen und Beschläge. Armaturen und Abdichtung Boden durch Ihren Sanitär oder nach Absprache.',
    'Glastüren': 'Montage in bestehende Zarge oder mit passenden Beschlägen. Aufmass vor Ort empfohlen.',
    'Glastrennwände': 'Montage mit Boden- und Wandprofilen oder Punkthaltern. Aufmass vor Ort empfohlen.',
    'Neue Glasplatten': 'Einbau nach Aufmass als Duschwand, Raumteiler oder Lichtwand. Beschläge nach Situation.',
    'Spiegel': 'Montage an der Wand. Bei LED: Anschluss an vorhandene Zuleitung.',
    'Glasbilder': 'Aufhängung an der Wand. Bei LED: Anschluss an vorhandene Zuleitung.',
    'Tische & Möbel': 'Lieferung, Aufstellen und Ausrichten.',
    'Zubehör': 'Montage an Wand oder Möbel.'
  };
  const SHIPPABLE = /Siphon|Tablarträger|Konsolen|Handtuch|Giese/i;

  const PLZ_FALLBACK = [
    [3800,'Unterseen / Interlaken / Matten',46.686,7.858],[3812,'Wilderswil',46.664,7.866],[3806,'Bönigen',46.687,7.893],[3852,'Ringgenberg',46.701,7.895],[3803,'Beatenberg',46.697,7.797],
    [3855,'Brienz',46.755,8.038],[3860,'Meiringen',46.727,8.187],[3818,'Grindelwald',46.624,8.041],[3822,'Lauterbrunnen',46.593,7.909],[3823,'Wengen',46.605,7.921],
    [3655,'Sigriswil',46.716,7.712],[3653,'Oberhofen',46.731,7.668],[3700,'Spiez',46.686,7.680],[3600,'Thun',46.758,7.628],[3612,'Steffisburg',46.778,7.633],
    [3714,'Frutigen',46.588,7.649],[3715,'Adelboden',46.492,7.560],[3718,'Kandersteg',46.495,7.674],[3770,'Zweisimmen',46.555,7.373],[3780,'Gstaad',46.475,7.286],
    [3000,'Bern',46.948,7.447],[3400,'Burgdorf',47.059,7.628],[3550,'Langnau',46.939,7.787],[3510,'Konolfingen',46.879,7.620],[3110,'Münsingen',46.873,7.561],
    [3123,'Belp',46.891,7.498],[3098,'Köniz',46.924,7.414],[2500,'Biel/Bienne',47.137,7.247],[1700,'Fribourg',46.806,7.161],[6000,'Luzern',47.050,8.306],
    [6060,'Sarnen',46.896,8.245],[8000,'Zürich',47.377,8.541],[4000,'Basel',47.559,7.588],[4500,'Solothurn',47.208,7.537],[4600,'Olten',47.350,7.904],
    [1000,'Lausanne',46.520,6.633],[1200,'Genève',46.204,6.143],[1950,'Sion',46.233,7.360],[3900,'Brig',46.316,7.988],[3930,'Visp',46.294,7.882]
  ];

  const toRad = value => value * Math.PI / 180;
  function haversineKm(a, b) {
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  async function fetchJson(url, timeoutMs = 7000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {signal: controller.signal, headers: {Accept: 'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  /* Adresse oder PLZ → Koordinaten. Primär geo.admin.ch (Schweiz, ohne Schlüssel), sekundär OpenStreetMap, zuletzt PLZ-Tabelle. */
  async function geocode(query) {
    const text = String(query || '').trim();
    if (!text) throw new Error('Bitte PLZ, Ort oder Adresse eingeben.');
    try {
      const data = await fetchJson(`https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(text)}&type=locations&origins=address,zipcode,gg25&limit=1&sr=4326`);
      const hit = data?.results?.[0]?.attrs;
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) return {lat: hit.lat, lon: hit.lon, label: String(hit.label || text).replace(/<[^>]+>/g, ''), source: 'geo.admin.ch'};
    } catch (_) { /* weiter mit Fallback */ }
    try {
      const data = await fetchJson(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch&q=${encodeURIComponent(text)}`);
      const hit = data?.[0];
      if (hit) return {lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name.split(',').slice(0, 2).join(','), source: 'openstreetmap'};
    } catch (_) { /* weiter mit Fallback */ }
    const plz = (text.match(/\b(\d{4})\b/) || [])[1];
    if (plz) {
      const exact = PLZ_FALLBACK.find(row => row[0] === Number(plz)) || PLZ_FALLBACK.find(row => String(row[0]).slice(0, 2) === plz.slice(0, 2));
      if (exact) return {lat: exact[2], lon: exact[3], label: `${plz} ${exact[1]}`, source: 'tabelle', approximate: true};
    }
    const name = PLZ_FALLBACK.find(row => row[1].toLowerCase().split(/ \/ /).some(part => text.toLowerCase().includes(part.toLowerCase())));
    if (name) return {lat: name[2], lon: name[3], label: name[1], source: 'tabelle', approximate: true};
    throw new Error('Ort nicht gefunden. Bitte PLZ und Ort prüfen.');
  }

  /* Strassendistanz ab Werk. Primär OSRM, sonst Luftlinie × 1.35. */
  async function roadDistanceKm(point) {
    try {
      const data = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${ORIGIN.lon},${ORIGIN.lat};${point.lon},${point.lat}?overview=false`, 6000);
      const meters = data?.routes?.[0]?.distance;
      if (Number.isFinite(meters)) return {km: meters / 1000, estimated: false};
    } catch (_) { /* Fallback */ }
    return {km: haversineKm(ORIGIN, point) * 1.35, estimated: true};
  }

  const zoneFor = km => TARIFF.zones.find(zone => km <= zone.maxKm);
  const installHours = product => (INSTALL[product.category] || (() => [1, 2]))(product);
  const isShippable = product => product.category === 'Zubehör' && SHIPPABLE.test(product.title);
  const round5 = value => Math.round(value / 5) * 5;

  /* Richtpreis für eine Auswahl. mode: 'pickup' | 'delivery' | 'install' */
  function estimate(products, mode, km) {
    const items = products.filter(product => !product.sold);
    const value = items.reduce((sum, product) => sum + (product.displayPrice || 0), 0);
    const unknownPrices = items.filter(product => product.displayPrice == null).length;
    const result = {mode, items: items.length, value, unknownPrices, lines: [], total: null, totalMax: null, onRequest: false, notes: []};
    if (mode === 'pickup' || !items.length) {
      result.lines.push({label: 'Abholung ab Werk Unterseen', value: 0});
      result.total = 0; result.totalMax = 0;
      return result;
    }
    if (km == null) { result.onRequest = true; result.notes.push('Standort eingeben, um Zone und Richtpreis zu sehen.'); return result; }
    const zone = zoneFor(km);
    result.zone = zone; result.km = km;
    if (mode === 'delivery') {
      if (items.every(isShippable)) {
        result.lines.push({label: 'Versand per Post', value: TARIFF.postalShipping});
        result.total = result.totalMax = TARIFF.postalShipping;
        return result;
      }
      if (zone.delivery == null) { result.onRequest = true; result.notes.push('Ausserhalb der Lieferzonen. Wir offerieren Transport individuell.'); return result; }
      const free = value >= TARIFF.freeDeliveryFrom;
      result.lines.push({label: `Lieferung ${zone.label}`, value: zone.delivery, strike: free});
      if (free) result.notes.push(`Lieferung gratis ab CHF ${TARIFF.freeDeliveryFrom.toLocaleString('de-CH')} Warenwert.`);
      result.total = result.totalMax = free ? 0 : zone.delivery;
      return result;
    }
    // install
    if (zone.travel == null) { result.onRequest = true; result.notes.push('Ausserhalb der Montagezonen. Wir offerieren Anfahrt und Montage individuell.'); return result; }
    let minHours = 0, maxHours = 0;
    for (const product of items) { const [lo, hi] = installHours(product); minHours += lo; maxHours += hi; }
    result.hours = [minHours, maxHours];
    result.lines.push({label: `Lieferung inbegriffen · ${zone.label}`, value: 0});
    if (zone.travel) result.lines.push({label: 'Anfahrtspauschale Montageteam', value: zone.travel});
    result.lines.push({label: `Montage ${minHours}–${maxHours} h × CHF ${TARIFF.hourlyRate}`, value: round5(minHours * TARIFF.hourlyRate), valueMax: round5(maxHours * TARIFF.hourlyRate)});
    result.total = zone.travel + round5(minHours * TARIFF.hourlyRate);
    result.totalMax = zone.travel + round5(maxHours * TARIFF.hourlyRate);
    const categories = [...new Set(items.map(product => product.category))];
    for (const category of categories) if (INSTALL_NOTE[category]) result.notes.push(INSTALL_NOTE[category]);
    return result;
  }

  /* Kurzer Hinweis pro Produkt für den Produktdialog. */
  function productHint(product) {
    if (product.sold) return null;
    const [lo, hi] = installHours(product);
    const zoneA = TARIFF.zones[0];
    const min = round5(lo * TARIFF.hourlyRate), max = round5(hi * TARIFF.hourlyRate);
    const delivery = isShippable(product) ? `Versand per Post CHF ${TARIFF.postalShipping}` : (product.displayPrice || 0) >= TARIFF.freeDeliveryFrom ? 'Lieferung gratis bis 80 km' : `Lieferung ab CHF ${zoneA.delivery}`;
    return {hours: [lo, hi], priceRange: [min, max], delivery, note: INSTALL_NOTE[product.category] || ''};
  }

  async function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Standortabfrage wird von diesem Gerät nicht unterstützt.'));
      navigator.geolocation.getCurrentPosition(
        position => resolve({lat: position.coords.latitude, lon: position.coords.longitude, label: 'Mein Standort', source: 'gps'}),
        () => reject(new Error('Standort nicht freigegeben. Bitte PLZ oder Adresse eingeben.')),
        {timeout: 8000, maximumAge: 300000}
      );
    });
  }

  window.CreaService = {ORIGIN, TARIFF, geocode, locate, roadDistanceKm, zoneFor, estimate, installHours, productHint, isShippable, haversineKm};
})();
