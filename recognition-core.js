/* Pure parsing shared by the browser and the automated checks. */
(function (root) {
  'use strict';
  const clean = value => typeof value === 'string' ? value.trim().slice(0, 160) : '';
  function volumeCl(text) {
    // Do not turn nutritional “per 100 ml” into container volume.
    const source = String(text || '').slice(0, 10000).replace(/(?:por|per|cada|\/|pour)\s*100\s*m[lL]/gi, '');
    const matches = [...source.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|litros?|litres?|l)\b/gi)];
    const values = matches.map(m => Number(m[1].replace(',', '.')) * (/^ml$/i.test(m[2]) ? .1 : /^cl$/i.test(m[2]) ? 1 : 100))
      .filter(v => v > 0 && v <= 500).map(v => Math.round(v * 1000) / 1000);
    return new Set(values).size === 1 ? values[0] : null;
  }
  function barcode(value) {
    const digits = String(value).trim();
    if (!/^(?:\d{8}|\d{12,14})$/.test(digits)) return null;
    let sum = 0;
    for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += +digits[i] * weight;
    return (10 - sum % 10) % 10 === +digits.at(-1) ? digits : null;
  }
  function codePayload(raw) {
    const source = String(raw).trim();
    const direct = barcode(source);
    if (direct) return { code: direct };
    try {
      const url = new URL(source);
      // Extract a GTIN or an OFF product ID; never navigate to scanned URLs.
      const match = url.pathname.match(/\/(?:01|product|producto|produit)\/(\d{8,14})(?:\/|$)/);
      const code = barcode(match?.[1] || url.searchParams.get('gtin') || '');
      return code ? { code } : { unsupported: true };
    } catch { /* May be a QR with explicit product fields. */ }
    try {
      const data = JSON.parse(source);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { unsupported: true };
      const code = barcode(data.gtin || data.barcode || '');
      if (code) return { code };
      const fields = { brand: clean(data.brand || data.marca), format: clean(data.format || data.formato) };
      fields.cl = data.cl != null && Number(data.cl) > 0 && Number(data.cl) <= 500 ? Number(data.cl) : volumeCl(data.volume || data.volumen || '');
      return fields.brand || fields.cl ? { fields } : { unsupported: true };
    } catch { return { unsupported: true }; }
  }
  function labelFields(text) {
    const lines = String(text).split(/\n/).map(s => s.trim()).filter(Boolean);
    const brands = ['Estrella Galicia', 'Estrella Damm', 'Voll-Damm', 'Mahou', 'Alhambra', 'Cruzcampo', 'Heineken', 'San Miguel', 'Amstel', 'Guinness', 'Corona', 'Budweiser', 'Paulaner', 'Leffe', 'BrewDog'];
    const brand = brands.find(b => text.toLowerCase().includes(b.toLowerCase())) ||
      lines.find(s => /[a-záéíóúñ]{3}/i.test(s) && !/ingred|nutri|kcal|energ|conserv|consum|elabor|contiene|alcohol|www\.|https?:|\d+\s*(?:ml|cl|%)/i.test(s)) || '';
    return { brand: brand.slice(0, 80), cl: volumeCl(String(text).slice(0, 10000)),
      format: /\b(lata|can)\b/i.test(text) ? 'Lata' : /\b(botella|bottle)\b/i.test(text) ? 'Botella' : '' };
  }
  function productFields(p) {
    const brand = clean(p.brands), name = clean(p.product_name_es || p.product_name);
    const quantity = clean(p.quantity);
    // Multipacks need a per-container size; do not use their total volume.
    const multipack = /\b\d+\s*[x×]/i.test(quantity);
    const explicit = volumeCl(quantity);
    const numeric = p.product_quantity && p.product_quantity_unit ? volumeCl(`${p.product_quantity} ${p.product_quantity_unit}`) : null;
    return {
      brand: (name.toLowerCase().includes(brand.toLowerCase()) ? name : [brand, name].filter(Boolean).join(' · ')).slice(0, 80),
      cl: explicit ?? (multipack ? null : numeric),
      format: /\b(lata|can|cans)\b/i.test(p.packaging || '') ? 'Lata' : /\b(botella|bottle|bottles)\b/i.test(p.packaging || '') ? 'Botella' : '',
      // OFF normalizes “_100g”; only use calories if an explicit 100 ml basis is present.
      kcal: /100\s*ml/i.test(p.nutrition_data_per || '') && Number.isFinite(p.nutriments?.['energy-kcal_100g']) ? p.nutriments['energy-kcal_100g'] : null
    };
  }
  function portraitStage(count) { return Math.min(7, Math.max(0, Math.floor(Number(count) || 0))); }
  const api = { volumeCl, barcode, codePayload, labelFields, productFields, portraitStage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeerRecognition = api;
})(globalThis);
