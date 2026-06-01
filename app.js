(function () {
  'use strict';

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rad = typeof r === 'number' ? r : 0;
      this.moveTo(x + rad, y);
      this.arcTo(x + w, y, x + w, y + h, rad);
      this.arcTo(x + w, y + h, x, y + h, rad);
      this.arcTo(x, y + h, x, y, rad);
      this.arcTo(x, y, x + w, y, rad);
      this.closePath();
    };
  }

  const QR_TYPES = [
    { id: 'link', label: 'Website link', group: 'Popular' },
    { id: 'wifi', label: 'WiFi network', group: 'Popular' },
    { id: 'whatsapp', label: 'WhatsApp', group: 'Popular' },
    { id: 'vcard', label: 'Contact card (vCard)', group: 'Popular' },
    { id: 'email', label: 'Email', group: 'Popular' },
    { id: 'text', label: 'Plain text', group: 'Popular' },
    { id: 'phone', label: 'Phone call', group: 'Contact' },
    { id: 'sms', label: 'SMS', group: 'Contact' },
    { id: 'social', label: 'Social profile', group: 'Contact' },
    { id: 'location', label: 'Map location', group: 'More' },
    { id: 'event', label: 'Calendar event', group: 'More' },
    { id: 'skype', label: 'Skype', group: 'More' },
    { id: 'zoom', label: 'Zoom meeting', group: 'More' },
    { id: 'paypal', label: 'PayPal', group: 'More' },
    { id: 'bitcoin', label: 'Bitcoin', group: 'More' },
    { id: 'pdf', label: 'PDF file link', group: 'Media' },
    { id: 'image', label: 'Image link', group: 'Media' },
    { id: 'video', label: 'Video link', group: 'Media' }
  ];

  const QUICK_TYPES = ['link', 'wifi', 'whatsapp', 'vcard', 'email', 'text'];

  const DEFAULTS = {
    link: { 'url-input': 'https://example.com' },
    text: { 'text-message': 'Hello, scan me!' },
    email: { 'email-to': 'hello@example.com', 'email-subject': 'Hello' },
    phone: { 'phone-number': '5551234567' },
    sms: { 'sms-number': '5551234567', 'sms-body': 'Hello' },
    whatsapp: { 'wa-number': '5551234567', 'wa-message': 'Hello!' },
    wifi: { ssid: 'MyNetwork', 'wifi-password': 'password123' },
    vcard: { 'vcard-first': 'Jane', 'vcard-last': 'Doe', 'vcard-email': 'jane@example.com' },
    location: { 'geo-lat': '40.7128', 'geo-lng': '-74.0060' },
    skype: { 'skype-user': 'username' },
    zoom: { 'zoom-id': '123456789' },
    event: { 'event-title': 'Meeting', 'event-start': '' },
    paypal: { 'pp-email': 'pay@example.com', 'pp-amount': '10' },
    bitcoin: { 'btc-address': 'bc1qexample' },
    social: { 'social-handle': 'brand' },
    pdf: { 'url-input': 'https://example.com/file.pdf' },
    image: { 'url-input': 'https://example.com/photo.jpg' },
    video: { 'url-input': 'https://youtube.com/watch?v=dQw4w9WgXcQ' }
  };

  const form = document.getElementById('qr-form');
  const typeSelect = document.getElementById('qr-type-select');
  const quickTypes = document.getElementById('quick-types');
  const fields = document.getElementById('dynamic-fields');
  const preview = document.getElementById('qr-preview');
  const previewEmpty = document.getElementById('preview-empty');
  const previewBadge = document.getElementById('preview-badge');
  const statusEl = document.getElementById('status');
  const downloadPng = document.getElementById('download-png');
  const downloadJpg = document.getElementById('download-jpg');
  const downloadSvg = document.getElementById('download-svg');
  const copyPayloadBtn = document.getElementById('copy-payload');

  let activeType = 'link';
  let lastPayload = '';
  let lastQr = null;
  let logoImage = null;
  let debounceTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function val(id) {
    const el = $(id);
    return el ? String(el.value).trim() : '';
  }

  function checked(id) {
    const el = $(id);
    return el ? el.checked : false;
  }

  function normalizeUrl(value) {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  function escapeVcard(v) {
    return String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  }

  function toIcalDate(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  }

  function phoneE164(codeId, numId) {
    const code = val(codeId).replace(/\s/g, '') || '+1';
    const num = val(numId).replace(/[^\d]/g, '');
    return num ? `${code}${num}` : '';
  }

  function countrySelect(id) {
    const codes = ['+1', '+44', '+61', '+49', '+33', '+91', '+86', '+81', '+55'];
    return `<select id="${id}" class="input-compact">${codes.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>`;
  }

  function fieldsFor(type) {
    const cc = countrySelect;
    const map = {
      link: `<label for="url-input">Website URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://yoursite.com" autocomplete="url">`,
      text: `<label for="text-message">Text</label><textarea id="text-message" rows="4" placeholder="Write any message"></textarea>`,
      email: `<label for="email-to">Email address</label><input id="email-to" type="email" placeholder="name@example.com"><label for="email-subject">Subject (optional)</label><input id="email-subject"><label for="email-body">Body (optional)</label><textarea id="email-body" rows="3"></textarea>`,
      location: `<label for="geo-lat">Latitude</label><input id="geo-lat" inputmode="decimal" placeholder="40.7128"><label for="geo-lng">Longitude</label><input id="geo-lng" inputmode="decimal" placeholder="-74.0060"><label for="geo-label">Label (optional)</label><input id="geo-label" placeholder="City name">`,
      phone: `<label>Country</label>${cc('phone-code')}<label for="phone-number">Phone number</label><input id="phone-number" inputmode="tel" placeholder="5551234567">`,
      sms: `<label>Country</label>${cc('sms-code')}<label for="sms-number">Phone number</label><input id="sms-number" inputmode="tel"><label for="sms-body">Message</label><textarea id="sms-body" rows="2"></textarea>`,
      whatsapp: `<label>Country</label>${cc('wa-code')}<label for="wa-number">Phone number</label><input id="wa-number" inputmode="tel"><label for="wa-message">Message (optional)</label><textarea id="wa-message" rows="2"></textarea>`,
      skype: `<label for="skype-user">Skype username</label><input id="skype-user" placeholder="username"><fieldset class="radio-row"><label><input type="radio" name="skype-action" value="chat" checked> Chat</label><label><input type="radio" name="skype-action" value="call"> Call</label></fieldset>`,
      zoom: `<label for="zoom-id">Meeting ID</label><input id="zoom-id" placeholder="123 456 7890"><label for="zoom-pwd">Password (optional)</label><input id="zoom-pwd">`,
      wifi: `<label for="ssid">Network name</label><input id="ssid" placeholder="My WiFi"><label for="wifi-encryption">Security</label><select id="wifi-encryption"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">Open</option></select><label for="wifi-password">Password</label><input id="wifi-password" type="text"><label class="check"><input id="wifi-hidden" type="checkbox"> Hidden network</label>`,
      vcard: `<div class="field-row"><div><label for="vcard-first">First name</label><input id="vcard-first"></div><div><label for="vcard-last">Last name</label><input id="vcard-last"></div></div><label for="vcard-email">Email</label><input id="vcard-email" type="email"><label for="vcard-phone">Phone</label><input id="vcard-phone" inputmode="tel"><label for="vcard-org">Company (optional)</label><input id="vcard-org">`,
      event: `<label for="event-title">Event title</label><input id="event-title"><label for="event-start">Starts</label><input id="event-start" type="datetime-local"><label for="event-end">Ends (optional)</label><input id="event-end" type="datetime-local"><label for="event-location">Location (optional)</label><input id="event-location">`,
      paypal: `<label for="pp-email">PayPal email</label><input id="pp-email" type="email"><label for="pp-item">Item name</label><input id="pp-item"><label for="pp-amount">Amount</label><input id="pp-amount" inputmode="decimal" placeholder="10.00">`,
      bitcoin: `<label for="btc-address">Bitcoin address</label><input id="btc-address"><label for="btc-amount">Amount BTC (optional)</label><input id="btc-amount" inputmode="decimal">`,
      social: `<label for="social-platform">Platform</label><select id="social-platform"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="x">X</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select><label for="social-handle">Username</label><input id="social-handle" placeholder="brand">`,
      pdf: `<label for="url-input">PDF URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://example.com/file.pdf">`,
      image: `<label for="url-input">Image URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://example.com/photo.jpg">`,
      video: `<label for="url-input">Video URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://youtube.com/...">`
    };
    return map[type] || map.link;
  }

  function applyDefaults(type) {
    const defs = DEFAULTS[type] || {};
    Object.entries(defs).forEach(([id, value]) => {
      const el = $(id);
      if (el && value) el.value = value;
    });
    if (type === 'event' && $('event-start') && !$('event-start').value) {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      $('event-start').value = toLocalInput(start);
      $('event-end').value = toLocalInput(end);
    }
  }

  function toLocalInput(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function buildPayload() {
    const t = activeType;
    if (t === 'link' || t === 'pdf' || t === 'image' || t === 'video') {
      const url = val('url-input');
      if (!url) throw new Error('Enter a URL to generate your QR code.');
      return normalizeUrl(url);
    }
    if (t === 'text') {
      const text = val('text-message');
      if (!text) throw new Error('Enter the text for your QR code.');
      return text;
    }
    if (t === 'email') {
      const to = val('email-to');
      if (!to) throw new Error('Enter an email address.');
      const params = new URLSearchParams();
      if (val('email-subject')) params.set('subject', val('email-subject'));
      if (val('email-body')) params.set('body', val('email-body'));
      const q = params.toString();
      return q ? `mailto:${to}?${q}` : `mailto:${to}`;
    }
    if (t === 'location') {
      const lat = val('geo-lat');
      const lng = val('geo-lng');
      if (!lat || !lng) throw new Error('Enter latitude and longitude.');
      const label = val('geo-label');
      return label ? `geo:${lat},${lng}?q=${encodeURIComponent(label)}` : `geo:${lat},${lng}`;
    }
    if (t === 'phone') {
      const p = phoneE164('phone-code', 'phone-number');
      if (!p) throw new Error('Enter a phone number.');
      return `tel:${p}`;
    }
    if (t === 'sms') {
      const p = phoneE164('sms-code', 'sms-number');
      if (!p) throw new Error('Enter a phone number.');
      const body = val('sms-body');
      return body ? `sms:${p}?body=${encodeURIComponent(body)}` : `sms:${p}`;
    }
    if (t === 'whatsapp') {
      const p = phoneE164('wa-code', 'wa-number').replace(/^\+/, '');
      if (!p) throw new Error('Enter a WhatsApp number.');
      const msg = val('wa-message');
      return msg ? `https://wa.me/${p}?text=${encodeURIComponent(msg)}` : `https://wa.me/${p}`;
    }
    if (t === 'skype') {
      const user = val('skype-user');
      if (!user) throw new Error('Enter a Skype username.');
      const mode = document.querySelector('input[name="skype-action"]:checked');
      return `skype:${user}?${mode && mode.value === 'call' ? 'call' : 'chat'}`;
    }
    if (t === 'zoom') {
      const id = val('zoom-id').replace(/\s/g, '');
      if (!id) throw new Error('Enter a Zoom meeting ID.');
      const pwd = val('zoom-pwd');
      return pwd ? `https://zoom.us/j/${id}?pwd=${encodeURIComponent(pwd)}` : `https://zoom.us/j/${id}`;
    }
    if (t === 'wifi') {
      const ssid = val('ssid');
      if (!ssid) throw new Error('Enter your WiFi network name.');
      const enc = val('wifi-encryption') || 'WPA';
      const pass = val('wifi-password');
      const hidden = checked('wifi-hidden');
      return `WIFI:T:${enc};S:${ssid};P:${pass}${hidden ? ';H:true' : ''};;`;
    }
    if (t === 'vcard') {
      const first = val('vcard-first');
      if (!first) throw new Error('Enter at least a first name.');
      const last = val('vcard-last');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVcard(`${first} ${last}`.trim())}`, `N:${escapeVcard(last)};${escapeVcard(first)};;;`];
      if (val('vcard-org')) lines.push(`ORG:${escapeVcard(val('vcard-org'))}`);
      if (val('vcard-phone')) lines.push(`TEL:${escapeVcard(val('vcard-phone'))}`);
      if (val('vcard-email')) lines.push(`EMAIL:${escapeVcard(val('vcard-email'))}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    if (t === 'event') {
      const title = val('event-title');
      if (!title) throw new Error('Enter an event title.');
      const start = toIcalDate(val('event-start'));
      if (!start) throw new Error('Pick a valid start date.');
      const end = toIcalDate(val('event-end')) || start;
      const lines = ['BEGIN:VEVENT', `SUMMARY:${escapeVcard(title)}`, `DTSTART:${start}`, `DTEND:${end}`];
      if (val('event-location')) lines.push(`LOCATION:${escapeVcard(val('event-location'))}`);
      lines.push('END:VEVENT');
      return lines.join('\n');
    }
    if (t === 'paypal') {
      const email = val('pp-email');
      if (!email) throw new Error('Enter your PayPal email.');
      const params = new URLSearchParams({ cmd: '_xclick', business: email, currency_code: 'USD' });
      if (val('pp-item')) params.set('item_name', val('pp-item'));
      if (val('pp-amount')) params.set('amount', val('pp-amount'));
      return `https://www.paypal.com/cgi-bin/webscr?${params}`;
    }
    if (t === 'bitcoin') {
      const address = val('btc-address');
      if (!address) throw new Error('Enter a Bitcoin address.');
      const params = new URLSearchParams();
      if (val('btc-amount')) params.set('amount', val('btc-amount'));
      const q = params.toString();
      return q ? `bitcoin:${address}?${q}` : `bitcoin:${address}`;
    }
    if (t === 'social') {
      const handle = val('social-handle').replace(/^@/, '');
      if (!handle) throw new Error('Enter a username.');
      const bases = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', x: 'https://x.com/', linkedin: 'https://www.linkedin.com/in/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@' };
      return `${bases[val('social-platform')] || bases.instagram}${handle}`;
    }
    throw new Error('Unsupported type.');
  }

  function getDesign() {
    return {
      size: Number($('qr-size').value) || 512,
      ecc: $('qr-ecc').value || 'M',
      dark: $('dark-color').value,
      light: $('light-color').value,
      transparent: checked('transparent-bg'),
      gradient: checked('gradient-enable'),
      gradientColor: $('gradient-color').value,
      moduleStyle: $('module-style').value,
      frameLabel: val('frame-label'),
      logoPad: true
    };
  }

  function isFinder(row, col, count) {
    if (row < 7 && col < 7) return true;
    if (row < 7 && col >= count - 7) return true;
    if (row >= count - 7 && col < 7) return true;
    return false;
  }

  function drawModule(ctx, x, y, size, style) {
    ctx.beginPath();
    if (style === 'dot') {
      ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
    } else if (style === 'rounded') {
      ctx.roundRect(x, y, size, size, size * 0.25);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.fill();
  }

  function drawFinder(ctx, x, y, cell, dark, light) {
    const s = cell * 7;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.rect(x, y, s, s);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.rect(x + cell, y + cell, cell * 5, cell * 5);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.rect(x + cell * 2, y + cell * 2, cell * 3, cell * 3);
    ctx.fill();
  }

  function renderQr(text, design) {
    if (typeof qrcode !== 'function') {
      throw new Error('QR library failed to load. Refresh the page.');
    }
    const qr = qrcode(0, design.ecc);
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const margin = 4;
    const labelH = design.frameLabel ? 36 : 0;
    const size = design.size;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + labelH;
    const ctx = canvas.getContext('2d');
    const cells = count + margin * 2;
    const cell = size / cells;

    if (!design.transparent) {
      ctx.fillStyle = design.light;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const layer = document.createElement('canvas');
    layer.width = size;
    layer.height = size;
    const lctx = layer.getContext('2d');

    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) {
        if (!qr.isDark(r, c)) continue;
        const x = Math.round((c + margin) * cell);
        const y = Math.round((r + margin) * cell);
        if (isFinder(r, c, count)) continue;
        lctx.fillStyle = '#000';
        drawModule(lctx, x, y, Math.max(1, Math.ceil(cell)), design.moduleStyle);
      }
    }

    lctx.globalCompositeOperation = 'source-in';
    if (design.gradient) {
      const g = lctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, design.dark);
      g.addColorStop(1, design.gradientColor);
      lctx.fillStyle = g;
    } else {
      lctx.fillStyle = design.dark;
    }
    lctx.fillRect(0, 0, size, size);
    lctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(layer, 0, 0);

    const light = design.transparent ? '#ffffff' : design.light;
    [[margin, margin], [margin + count - 7, margin], [margin, margin + count - 7]].forEach(([fx, fy]) => {
      drawFinder(ctx, Math.round(fx * cell), Math.round(fy * cell), cell, design.dark, light);
    });

    if (logoImage) {
      const logoSize = size * 0.2;
      const lx = (size - logoSize) / 2;
      const ly = (size - logoSize) / 2;
      ctx.fillStyle = light;
      ctx.fillRect(lx - 6, ly - 6, logoSize + 12, logoSize + 12);
      ctx.drawImage(logoImage, lx, ly, logoSize, logoSize);
    }

    if (design.frameLabel) {
      ctx.fillStyle = design.dark;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(design.frameLabel, size / 2, size + 24);
    }

    return { canvas, qr };
  }

  function setBadge(state, text) {
    previewBadge.className = `badge badge-${state}`;
    previewBadge.textContent = text;
  }

  function setDownloads(on) {
    downloadPng.disabled = !on;
    downloadJpg.disabled = !on;
    downloadSvg.disabled = !on;
    copyPayloadBtn.disabled = !on;
  }

  function showCanvas(canvas) {
    preview.querySelectorAll('canvas').forEach((n) => n.remove());
    previewEmpty.hidden = true;
    canvas.className = 'qr-canvas';
    preview.appendChild(canvas);
  }

  function showEmpty(message) {
    preview.querySelectorAll('canvas').forEach((n) => n.remove());
    previewEmpty.hidden = false;
    previewEmpty.querySelector('p').textContent = message || 'Your QR code appears here as you fill in the form.';
    setDownloads(false);
    setBadge('idle', 'Waiting for input');
  }

  function updatePreview() {
    statusEl.textContent = '';
    statusEl.className = 'status';
    try {
      const payload = buildPayload();
      const design = getDesign();
      const { canvas, qr } = renderQr(payload, design);
      lastPayload = payload;
      lastQr = qr;
      showCanvas(canvas);
      setDownloads(true);
      setBadge('ready', 'Ready');
      statusEl.textContent = 'Scan with your phone to test before printing.';
      statusEl.className = 'status status-ok';
    } catch (err) {
      showEmpty(err.message);
      statusEl.textContent = err.message;
      statusEl.className = 'status status-warn';
    }
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 280);
  }

  function renderTypeSelect() {
    const groups = [...new Set(QR_TYPES.map((t) => t.group))];
    typeSelect.innerHTML = groups.map((g) => {
      const opts = QR_TYPES.filter((t) => t.group === g).map((t) => `<option value="${t.id}">${t.label}</option>`).join('');
      return `<optgroup label="${g}">${opts}</optgroup>`;
    }).join('');
    typeSelect.value = activeType;
  }

  function renderQuickTypes() {
    quickTypes.innerHTML = QUICK_TYPES.map((id) => {
      const t = QR_TYPES.find((x) => x.id === id);
      return `<button type="button" class="quick-type${id === activeType ? ' is-active' : ''}" data-type="${id}">${t.label}</button>`;
    }).join('');
    quickTypes.querySelectorAll('.quick-type').forEach((btn) => {
      btn.addEventListener('click', () => setType(btn.dataset.type));
    });
  }

  function setType(type) {
    activeType = type;
    typeSelect.value = type;
    renderQuickTypes();
    fields.innerHTML = fieldsFor(type);
    applyDefaults(type);
    fields.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', scheduleUpdate);
      el.addEventListener('change', scheduleUpdate);
    });
    $('content-heading').textContent = QR_TYPES.find((t) => t.id === type).label;
    updatePreview();
  }

  function initTypeSelect() {
    renderTypeSelect();
    typeSelect.addEventListener('change', () => setType(typeSelect.value));
    renderQuickTypes();
    setType('link');
  }

  function bindCustomize() {
    $('gradient-enable').addEventListener('change', (e) => {
      $('gradient-color').disabled = !e.target.checked;
      scheduleUpdate();
    });
    $('transparent-bg').addEventListener('change', (e) => {
      $('light-color').disabled = e.target.checked;
      scheduleUpdate();
    });
    ['qr-size', 'qr-ecc', 'dark-color', 'light-color', 'gradient-color', 'module-style', 'frame-label'].forEach((id) => {
      $(id).addEventListener('input', scheduleUpdate);
      $(id).addEventListener('change', scheduleUpdate);
    });
    $('logo-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        logoImage = null;
        scheduleUpdate();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          logoImage = img;
          $('qr-ecc').value = 'H';
          scheduleUpdate();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  downloadPng.addEventListener('click', () => {
    const canvas = preview.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'qrcode.png';
    a.click();
  });

  downloadJpg.addEventListener('click', () => {
    const canvas = preview.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = 'qrcode.jpg';
    a.click();
  });

  downloadSvg.addEventListener('click', () => {
    if (!lastQr) return;
    const design = getDesign();
    const cell = Math.max(4, Math.floor(design.size / (lastQr.getModuleCount() + 8)));
    let svg = lastQr.createSvgTag(cell, 4, 'QR code');
    svg = svg.replace(/#000000/g, design.dark).replace(/#ffffff/g, design.transparent ? 'none' : design.light);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = 'qrcode.svg';
    a.click();
  });

  copyPayloadBtn.addEventListener('click', async () => {
    if (!lastPayload) return;
    try {
      await navigator.clipboard.writeText(lastPayload);
      statusEl.textContent = 'Copied encoded data to clipboard.';
      statusEl.className = 'status status-ok';
    } catch {
      statusEl.textContent = 'Copy failed — select the text in the URL field instead.';
      statusEl.className = 'status status-warn';
    }
  });

  form.addEventListener('submit', (e) => e.preventDefault());

  initTypeSelect();
  bindCustomize();
})();
