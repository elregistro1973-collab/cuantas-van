/* Optional recognition: libraries load only after a user requests this feature. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const libraries = new Map();
  let epoch = 0, busy = false, reader = null, starting = null, stopping = null, worker = null, request = null;
  const status = text => { el('scan-status').textContent = text; };
  function lock(value) {
    busy = value;
    el('recognition-tools').setAttribute('aria-busy', String(value));
    for (const node of el('recognition-tools').querySelectorAll('[data-recognition-action]')) node.disabled = value;
    el('saveBeer').disabled = value;
  }
  function library(name, src) {
    if (window[name]) return Promise.resolve();
    if (!libraries.has(name)) libraries.set(name, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { script.remove();libraries.delete(name);reject(new Error('No se pudo descargar el lector. Comprueba la conexión y vuelve a intentarlo.')); }, 20000);
      script.src = src;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer);script.remove();libraries.delete(name);reject(new Error('No se pudo cargar el lector. Puedes completar los datos a mano.')); };
      document.head.append(script);
    }));
    return libraries.get(name);
  }
  async function stopCamera() {
    if (stopping) return stopping;
    stopping = (async () => {
      if (starting) await starting.catch(() => {});
      if (reader?.isScanning) await reader.stop();
      if (reader) { reader.clear(); reader = null; }
      el('stop-scan').hidden = true;
    })();
    try { await stopping; } finally { starting = null; stopping = null; }
  }
  function active(token) { return token === epoch && el('editor').open; }
  function apply(fields, origin) {
    const f = el('beer').elements;
    // A new recognition replaces the previous product, never inherits its volume or price.
    for (const name of ['brand', 'format', 'cl', 'kcal', 'price']) f[name].value = '';
    for (const name of ['brand', 'format', 'cl', 'kcal']) {
      if (fields[name] !== null && fields[name] !== undefined) f[name].value = fields[name];
    }
    status(`${origin} Revisa los datos propuestos y completa los que falten. El precio es el de tu bar.`);
    f[fields.brand ? (fields.cl ? 'price' : 'cl') : 'brand'].focus();
  }
  async function resolveCode(raw, token) {
    const result = BeerRecognition.codePayload(raw);
    if (result.unsupported) throw new Error('Código leído, pero no contiene un identificador de producto compatible. Prueba con el código de barras o una foto de la etiqueta.');
    if (result.fields) { if (active(token)) apply(result.fields, 'Datos leídos del QR.'); return; }
    status('Código leído. Buscando la cerveza…');
    request = new AbortController();
    const controller = request;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const fields = 'brands,product_name,product_name_es,quantity,product_quantity,product_quantity_unit,packaging,nutriments,nutrition_data_per';
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${result.code}?fields=${fields}`, { signal: controller.signal });
      if (!response.ok) throw new Error('La búsqueda no está disponible. Prueba con una foto de la etiqueta o rellena los datos.');
      const data = await response.json();
      if (!active(token)) return;
      if (data.status !== 1 || !data.product) throw new Error('No encontramos ese código. Prueba con una foto de la etiqueta o rellena los datos.');
      apply(BeerRecognition.productFields(data.product), 'Producto encontrado en Open Food Facts.');
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('La búsqueda ha tardado demasiado. Comprueba la conexión o introduce los datos.');
      if (error instanceof TypeError) throw new Error('No hay conexión con el catálogo. Puedes introducir los datos a mano.');
      throw error;
    } finally { clearTimeout(timer);if (request === controller) request = null; }
  }
  async function operation(task) {
    if (busy) return;
    const token = ++epoch; lock(true);
    try { await task(token); }
    catch (error) { if (active(token)) status(error.message || 'No se pudo leer la imagen. Prueba otra foto o completa los datos a mano.'); }
    finally { await stopCamera().catch(() => {});lock(false); }
  }
  el('scan-camera').onclick = () => operation(async token => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('La cámara en directo no está disponible aquí. Usa «Foto del código» o «Foto de etiqueta».');
    status('Preparando la cámara…');
    await library('Html5Qrcode', 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js');
    if (!active(token)) return;
    reader = new Html5Qrcode('reader');
    let handled = false;
    // Keep this operation busy until the live scan ends or the editor closes.
    await new Promise((resolve, reject) => {
      let monitor;
      const finish = () => { clearInterval(monitor);resolve(); };
      starting = reader.start({ facingMode: 'environment' }, { fps: 8 }, async raw => {
        if (handled || !active(token)) return;
        handled = true;
        try { await stopCamera();if (active(token)) await resolveCode(raw, token); }
        catch (error) { if (active(token)) status(error.message); }
        finally { finish(); }
      }, () => {});
      starting.then(() => {
        if (!active(token)) { stopCamera().finally(finish); return; }
        el('stop-scan').hidden = false;
        status('Encuadra el código de barras o QR. Lo leeremos automáticamente.');
        monitor = setInterval(() => { if (!active(token)) { clearInterval(monitor);stopCamera().finally(finish); } }, 200);
      }).catch(() => { clearInterval(monitor);reject(new Error('No se pudo abrir la cámara. Revisa el permiso o usa una foto del código.')); });
    });
  });
  el('stop-scan').onclick = async () => { ++epoch; await stopCamera();status('Cámara cerrada. Puedes usar una foto o introducir los datos.'); };
  el('code-photo').onchange = e => {
    const file = e.target.files[0];e.target.value = '';if (!file) return;
    operation(async token => {
      status('Leyendo el código de la foto…');
      await library('Html5Qrcode', 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js');
      if (!active(token)) return;
      reader = new Html5Qrcode('reader');
      let raw;
      try { raw = await reader.scanFile(file, false); }
      catch { throw new Error('No se distingue el código. Haz una foto de cerca, enfocada y sin reflejos.'); }
      finally { await stopCamera(); }
      if (active(token)) await resolveCode(raw, token);
    });
  };
  el('lookup-code').onclick = () => operation(token => resolveCode(el('barcode-number').value.trim(), token));
  el('barcode-number').onkeydown = e => { if (e.key === 'Enter') {e.preventDefault();el('lookup-code').click();} };
  el('label-photo').onchange = e => {
    const file = e.target.files[0];e.target.value = '';if (!file) return;
    operation(async token => {
      status('Preparando la lectura de la etiqueta. La primera vez puede tardar…');
      let localWorker;
      try {
        await library('Tesseract', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
        if (!active(token)) return;
        localWorker = await Tesseract.createWorker('spa+eng', 1, { logger: message => {
          if (active(token) && message.status === 'recognizing text') status(`Leyendo la etiqueta… ${Math.round(message.progress * 100)} %`);
        } });
        if (!active(token)) return;
        worker = localWorker;
        const result = await localWorker.recognize(file);
        if (!active(token)) return;
        el('label-text').textContent = result.data.text;
        el('label-result').hidden = false;
        const fields = BeerRecognition.labelFields(result.data.text);
        if (!fields.brand && !fields.cl) throw new Error('No hemos podido extraer marca o volumen. Prueba con la etiqueta frontal, bien iluminada, o completa los datos.');
        apply(fields, 'Lectura aproximada de la etiqueta.');
      } catch (error) {
        if (active(token)) throw new Error(error.message?.startsWith('No hemos') ? error.message : 'No se pudo leer la etiqueta. Comprueba la conexión y prueba con una foto JPEG o PNG nítida.');
      } finally {
        if (localWorker) { try { await localWorker.terminate(); } catch {} }
        if (worker === localWorker) worker = null;
      }
    });
  };
  function cancel() {
    ++epoch;request?.abort();
    if (worker) {worker.terminate().catch(() => {});worker = null;}
    stopCamera().catch(() => { status('No se pudo cerrar el lector. Cierra la pestaña para liberar la cámara.'); });
  }
  el('editor').addEventListener('close', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  window.addEventListener('pagehide', cancel);
  window.resetRecognition = () => {
    status('');el('label-result').hidden = true;el('label-text').textContent = '';el('barcode-number').value = '';
  };
})();
