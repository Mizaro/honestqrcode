/* Get QR Code — client-side generator with competitor-style UX */
(function () {
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
      const radius = typeof r === 'number' ? r : 0;
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
    };
  }

  const form = document.getElementById('qr-form');
  const typeTabs = document.getElementById('type-tabs');
  const fields = document.getElementById('dynamic-fields');
  const statusEl = document.getElementById('status');
  const preview = document.getElementById('qr-preview');
  const downloadPng = document.getElementById('download-png');
  const downloadJpg = document.getElementById('download-jpg');
  const downloadSvg = document.getElementById('download-svg');
  const copyPayloadBtn = document.getElementById('copy-payload');

  let activeType = 'link';
  let lastPayload = '';
  let lastQr = null;
  let logoImage = null;
  let previewTimer = null;

  const QR_TYPES = [
    { id: 'link', label: 'Link', icon: '🔗' },
    { id: 'text', label: 'Text', icon: '📝' },
    { id: 'email', label: 'Email', icon: '✉️' },
    { id: 'location', label: 'Location', icon: '📍' },
    { id: 'phone', label: 'Phone', icon: '📞' },
    { id: 'sms', label: 'SMS', icon: '💬' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { id: 'skype', label: 'Skype', icon: '💻' },
    { id: 'zoom', label: 'Zoom', icon: '🎥' },
    { id: 'wifi', label: 'WiFi', icon: '📶' },
    { id: 'vcard', label: 'vCard', icon: '👤' },
    { id: 'event', label: 'Event', icon: '📅' },
    { id: 'paypal', label: 'PayPal', icon: '💳' },
    { id: 'bitcoin', label: 'Bitcoin', icon: '₿' },
    { id: 'social', label: 'Social', icon: '🌐' },
    { id: 'pdf', label: 'PDF', icon: '📄' },
    { id: 'image', label: 'Image', icon: '🖼️' },
    { id: 'video', label: 'Video', icon: '🎬' }
  ];

  const COUNTRY_CODES = [
    ['+1', 'US/CA (+1)'], ['+44', 'UK (+44)'], ['+61', 'AU (+61)'],
    ['+49', 'DE (+49)'], ['+33', 'FR (+33)'], ['+39', 'IT (+39)'],
    ['+34', 'ES (+34)'], ['+31', 'NL (+31)'], ['+48', 'PL (+48)'],
    ['+55', 'BR (+55)'], ['+52', 'MX (+52)'], ['+91', 'IN (+91)'],
    ['+86', 'CN (+86)'], ['+81', 'JP (+81)'], ['+82', 'KR (+82)'],
    ['+65', 'SG (+65)'], ['+971', 'AE (+971)'], ['+27', 'ZA (+27)']
  ];

  function countrySelect(id, selected = '+1') {
    const opts = COUNTRY_CODES.map(([v, l]) =>
      `<option value="${v}"${v === selected ? ' selected' : ''}>${l}</option>`
    ).join('');
    return `<select id="${id}" class="country-code">${opts}</select>`;
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function checked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }

  function phoneE164(codeId, numberId) {
    const code = val(codeId).replace(/\s/g, '');
    const num = val(numberId).replace(/[^\d]/g, '');
    if (!num) return '';
    return `${code}${num}`;
  }

  function normalizeUrl(value) {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  function escapeVcard(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  }

  function toIcalDate(localValue) {
    if (!localValue) return '';
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }

  function fieldHtml(type) {
    const cc = (a, b) => countrySelect(a, b);
    const templates = {
      link: `
        <label for="url-input">URL</label>
        <input id="url-input" inputmode="url" placeholder="https://example.com" required>`,
      text: `
        <label for="text-message">Message</label>
        <textarea id="text-message" placeholder="Your text" required></textarea>`,
      email: `
        <label for="email-to">Send to</label>
        <input id="email-to" type="email" placeholder="name@example.com" required>
        <label for="email-subject">Subject</label>
        <input id="email-subject" placeholder="Subject">
        <label for="email-body">Message</label>
        <textarea id="email-body" placeholder="Email body"></textarea>`,
      location: `
        <label for="geo-lat">Latitude</label>
        <input id="geo-lat" inputmode="decimal" placeholder="40.7128" required>
        <label for="geo-lng">Longitude</label>
        <input id="geo-lng" inputmode="decimal" placeholder="-74.0060" required>
        <label for="geo-label">Place name (optional)</label>
        <input id="geo-label" placeholder="New York City">`,
      phone: `
        <label>Country code</label>${cc('phone-code', '+1')}
        <label for="phone-number">Phone number</label>
        <input id="phone-number" inputmode="tel" placeholder="5551234567" required>`,
      sms: `
        <label>Country code</label>${cc('sms-code', '+1')}
        <label for="sms-number">Phone number</label>
        <input id="sms-number" inputmode="tel" placeholder="5551234567" required>
        <label for="sms-body">Message</label>
        <textarea id="sms-body" placeholder="SMS text"></textarea>`,
      whatsapp: `
        <label>Country code</label>${cc('wa-code', '+1')}
        <label for="wa-number">Phone number</label>
        <input id="wa-number" inputmode="tel" placeholder="5551234567" required>
        <label for="wa-message">Message (optional)</label>
        <textarea id="wa-message" placeholder="Hello"></textarea>`,
      skype: `
        <fieldset class="inline-radio">
          <legend>Action</legend>
          <label><input type="radio" name="skype-action" value="chat" checked> Chat</label>
          <label><input type="radio" name="skype-action" value="call"> Call</label>
        </fieldset>
        <label for="skype-user">Username</label>
        <input id="skype-user" placeholder="live:username" required>`,
      zoom: `
        <label for="zoom-id">Meeting ID</label>
        <input id="zoom-id" placeholder="123 456 7890" required>
        <label for="zoom-pwd">Password (optional)</label>
        <input id="zoom-pwd" placeholder="Meeting password">`,
      wifi: `
        <label for="ssid">Network name</label>
        <input id="ssid" placeholder="My WiFi" required>
        <label for="wifi-encryption">Network type</label>
        <select id="wifi-encryption">
          <option value="WPA">WPA/WPA2</option>
          <option value="WEP">WEP</option>
          <option value="nopass">No encryption</option>
        </select>
        <label for="wifi-password">Password</label>
        <input id="wifi-password" type="text" placeholder="Password">
        <label class="checkbox-row"><input id="wifi-hidden" type="checkbox"> Hidden network</label>`,
      vcard: `
        <label for="vcard-version">Version</label>
        <select id="vcard-version"><option value="3.0">3.0</option><option value="2.1">2.1</option></select>
        <label for="vcard-first">First name</label><input id="vcard-first" required>
        <label for="vcard-last">Last name</label><input id="vcard-last">
        <label for="vcard-org">Company</label><input id="vcard-org">
        <label for="vcard-title">Job title</label><input id="vcard-title">
        <label for="vcard-phone">Phone</label><input id="vcard-phone" inputmode="tel">
        <label for="vcard-email">Email</label><input id="vcard-email" type="email">
        <label for="vcard-url">Website</label><input id="vcard-url" inputmode="url">
        <label for="vcard-street">Address</label><input id="vcard-street">
        <label for="vcard-city">City</label><input id="vcard-city">
        <label for="vcard-region">State</label><input id="vcard-region">
        <label for="vcard-zip">Post code</label><input id="vcard-zip">
        <label for="vcard-country">Country</label><input id="vcard-country">`,
      event: `
        <label for="event-title">Event title</label><input id="event-title" required>
        <label for="event-location">Location</label><input id="event-location">
        <label for="event-start">Start</label><input id="event-start" type="datetime-local" required>
        <label for="event-end">End</label><input id="event-end" type="datetime-local">
        <label for="event-notes">Notes</label><textarea id="event-notes"></textarea>
        <label for="event-url">Link</label><input id="event-url" inputmode="url">`,
      paypal: `
        <label for="pp-type">Payment type</label>
        <select id="pp-type">
          <option value="_xclick">Buy now</option>
          <option value="_cart">Add to cart</option>
          <option value="_donations">Donation</option>
        </select>
        <label for="pp-email">PayPal email</label><input id="pp-email" type="email" required>
        <label for="pp-item">Item name</label><input id="pp-item">
        <label for="pp-amount">Price</label><input id="pp-amount" inputmode="decimal" placeholder="10.00">
        <label for="pp-currency">Currency</label>
        <select id="pp-currency">
          <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
          <option value="CAD">CAD</option><option value="AUD">AUD</option>
        </select>`,
      bitcoin: `
        <label for="btc-address">Address</label><input id="btc-address" required>
        <label for="btc-amount">Amount (BTC, optional)</label><input id="btc-amount" inputmode="decimal">
        <label for="btc-label">Item name</label><input id="btc-label">
        <label for="btc-message">Message</label><input id="btc-message">`,
      social: `
        <label for="social-platform">Platform</label>
        <select id="social-platform">
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="x">X (Twitter)</option>
          <option value="linkedin">LinkedIn</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
        <label for="social-handle">Username or handle</label>
        <input id="social-handle" placeholder="@brand" required>`,
      pdf: `
        <label for="url-input">PDF URL</label>
        <input id="url-input" inputmode="url" placeholder="https://example.com/file.pdf" required>`,
      image: `
        <label for="url-input">Image URL</label>
        <input id="url-input" inputmode="url" placeholder="https://example.com/photo.jpg" required>`,
      video: `
        <label for="url-input">Video URL</label>
        <input id="url-input" inputmode="url" placeholder="https://youtube.com/watch?v=..." required>`
    };
    return templates[type] || templates.link;
  }

  function buildPayload() {
    const type = activeType;
    if (type === 'link' || type === 'pdf' || type === 'image' || type === 'video') {
      const url = val('url-input');
      if (!url) throw new Error('Enter a valid URL');
      return normalizeUrl(url);
    }
    if (type === 'text') {
      const t = val('text-message');
      if (!t) throw new Error('Enter text');
      return t;
    }
    if (type === 'email') {
      const to = val('email-to');
      if (!to) throw new Error('Enter recipient email');
      const params = new URLSearchParams();
      if (val('email-subject')) params.set('subject', val('email-subject'));
      if (val('email-body')) params.set('body', val('email-body'));
      const q = params.toString();
      return q ? `mailto:${to}?${q}` : `mailto:${to}`;
    }
    if (type === 'location') {
      const lat = val('geo-lat');
      const lng = val('geo-lng');
      if (!lat || !lng) throw new Error('Enter latitude and longitude');
      const label = val('geo-label');
      return label
        ? `geo:${lat},${lng}?q=${encodeURIComponent(`${lat},${lng}(${label})`)}`
        : `geo:${lat},${lng}`;
    }
    if (type === 'phone') {
      const p = phoneE164('phone-code', 'phone-number');
      if (!p) throw new Error('Enter phone number');
      return `tel:${p}`;
    }
    if (type === 'sms') {
      const p = phoneE164('sms-code', 'sms-number');
      if (!p) throw new Error('Enter phone number');
      const body = val('sms-body');
      return body ? `sms:${p}?body=${encodeURIComponent(body)}` : `sms:${p}`;
    }
    if (type === 'whatsapp') {
      const p = phoneE164('wa-code', 'wa-number').replace(/^\+/, '');
      if (!p) throw new Error('Enter phone number');
      const msg = val('wa-message');
      return msg ? `https://wa.me/${p}?text=${encodeURIComponent(msg)}` : `https://wa.me/${p}`;
    }
    if (type === 'skype') {
      const user = val('skype-user');
      if (!user) throw new Error('Enter Skype username');
      const action = document.querySelector('input[name="skype-action"]:checked');
      const mode = action && action.value === 'call' ? 'call' : 'chat';
      return `skype:${user}?${mode}`;
    }
    if (type === 'zoom') {
      const id = val('zoom-id').replace(/\s/g, '');
      if (!id) throw new Error('Enter meeting ID');
      const pwd = val('zoom-pwd');
      return pwd ? `https://zoom.us/j/${id}?pwd=${encodeURIComponent(pwd)}` : `https://zoom.us/j/${id}`;
    }
    if (type === 'wifi') {
      const ssid = val('ssid');
      if (!ssid) throw new Error('Enter WiFi name');
      const enc = val('wifi-encryption') || 'WPA';
      const pass = val('wifi-password');
      const hidden = checked('wifi-hidden') ? 'true' : 'false';
      return `WIFI:T:${enc};S:${ssid};P:${pass}${hidden === 'true' ? ';H:true' : ''};;`;
    }
    if (type === 'vcard') {
      const first = val('vcard-first');
      if (!first) throw new Error('Enter first name');
      const last = val('vcard-last');
      const fn = `${first} ${last}`.trim();
      const ver = val('vcard-version') || '3.0';
      const lines = ['BEGIN:VCARD', `VERSION:${ver}`, `FN:${escapeVcard(fn)}`, `N:${escapeVcard(last)};${escapeVcard(first)};;;`];
      if (val('vcard-org')) lines.push(`ORG:${escapeVcard(val('vcard-org'))}`);
      if (val('vcard-title')) lines.push(`TITLE:${escapeVcard(val('vcard-title'))}`);
      if (val('vcard-phone')) lines.push(`TEL;TYPE=CELL:${escapeVcard(val('vcard-phone'))}`);
      if (val('vcard-email')) lines.push(`EMAIL:${escapeVcard(val('vcard-email'))}`);
      if (val('vcard-url')) lines.push(`URL:${escapeVcard(normalizeUrl(val('vcard-url')))}`);
      const street = val('vcard-street');
      if (street || val('vcard-city')) {
        lines.push(`ADR;TYPE=HOME:;;${escapeVcard(street)};${escapeVcard(val('vcard-city'))};${escapeVcard(val('vcard-region'))};${escapeVcard(val('vcard-zip'))};${escapeVcard(val('vcard-country'))}`);
      }
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    if (type === 'event') {
      const title = val('event-title');
      if (!title) throw new Error('Enter event title');
      const start = toIcalDate(val('event-start'));
      if (!start) throw new Error('Enter valid start time');
      const end = toIcalDate(val('event-end')) || start;
      const lines = [
        'BEGIN:VEVENT',
        `SUMMARY:${escapeVcard(title)}`,
        `DTSTART:${start}`,
        `DTEND:${end}`
      ];
      if (val('event-location')) lines.push(`LOCATION:${escapeVcard(val('event-location'))}`);
      if (val('event-notes')) lines.push(`DESCRIPTION:${escapeVcard(val('event-notes'))}`);
      if (val('event-url')) lines.push(`URL:${escapeVcard(normalizeUrl(val('event-url')))}`);
      lines.push('END:VEVENT');
      return lines.join('\n');
    }
    if (type === 'paypal') {
      const email = val('pp-email');
      if (!email) throw new Error('Enter PayPal email');
      const params = new URLSearchParams({
        cmd: val('pp-type') || '_xclick',
        business: email,
        currency_code: val('pp-currency') || 'USD'
      });
      if (val('pp-item')) params.set('item_name', val('pp-item'));
      if (val('pp-amount')) params.set('amount', val('pp-amount'));
      return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
    }
    if (type === 'bitcoin') {
      const address = val('btc-address');
      if (!address) throw new Error('Enter Bitcoin address');
      const params = new URLSearchParams();
      if (val('btc-amount')) params.set('amount', val('btc-amount'));
      if (val('btc-label')) params.set('label', val('btc-label'));
      if (val('btc-message')) params.set('message', val('btc-message'));
      const q = params.toString();
      return q ? `bitcoin:${address}?${q}` : `bitcoin:${address}`;
    }
    if (type === 'social') {
      const handle = val('social-handle').replace(/^@/, '');
      if (!handle) throw new Error('Enter username');
      const base = {
        instagram: 'https://instagram.com/',
        facebook: 'https://facebook.com/',
        x: 'https://x.com/',
        linkedin: 'https://www.linkedin.com/in/',
        tiktok: 'https://www.tiktok.com/@',
        youtube: 'https://www.youtube.com/@'
      };
      const platform = val('social-platform');
      return `${base[platform] || base.instagram}${handle}`;
    }
    throw new Error('Unsupported QR type');
  }

  function getDesign() {
    return {
      size: Number(document.getElementById('qr-size').value),
      ecc: document.getElementById('qr-ecc').value,
      dark: document.getElementById('dark-color').value,
      light: document.getElementById('light-color').value,
      transparent: checked('transparent-bg'),
      gradient: checked('gradient-enable'),
      gradientColor: document.getElementById('gradient-color').value,
      gradientRadial: checked('gradient-radial'),
      moduleStyle: document.getElementById('module-style').value,
      markerStyle: document.getElementById('marker-style').value,
      customMarkers: checked('custom-marker-colors'),
      markerBorder: document.getElementById('marker-border-color').value,
      markerCenter: document.getElementById('marker-center-color').value,
      frameLabel: val('frame-label'),
      logoPad: checked('logo-remove-bg')
    };
  }

  function isFinder(row, col, count) {
    if (row < 7 && col < 7) return 'tl';
    if (row < 7 && col >= count - 7) return 'tr';
    if (row >= count - 7 && col < 7) return 'bl';
    return null;
  }





  function drawModule(ctx, x, y, size, style) {
    if (style === 'dot') {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (style === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y);
      ctx.lineTo(x + size, y + size / 2);
      ctx.lineTo(x + size / 2, y + size);
      ctx.lineTo(x, y + size / 2);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (style === 'rounded') {
      const r = size * 0.28;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, r);
      ctx.fill();
      return;
    }
    ctx.fillRect(x, y, size, size);
  }

  function drawFinder(ctx, x, y, cell, style, borderColor, centerColor) {
    const s = cell * 7;
    ctx.fillStyle = borderColor;
    if (style === 'circle') {
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = centerColor;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (style === 'leaf') {
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, cell * 2.2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.roundRect(x + cell, y + cell, cell * 5, cell * 5, cell * 1.5);
      ctx.fill();
      ctx.fillStyle = centerColor;
      ctx.roundRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell);
      ctx.fill();
      return;
    }
    const radius = style === 'rounded' ? cell * 0.9 : 0;
    ctx.beginPath();
    if (radius) ctx.roundRect(x, y, s, s, radius);
    else ctx.rect(x, y, s, s);
    ctx.fill();
    ctx.fillStyle = '#fff';
    if (radius) ctx.roundRect(x + cell, y + cell, cell * 5, cell * 5, radius * 0.6);
    else ctx.fillRect(x + cell, y + cell, cell * 5, cell * 5);
    ctx.fill();
    ctx.fillStyle = centerColor;
    if (radius) ctx.roundRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3, radius * 0.4);
    else ctx.fillRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3);
    ctx.fill();
  }

  function renderStyledQr(qr, design) {
    const count = qr.getModuleCount();
    const margin = 4;
    const labelHeight = design.frameLabel ? 44 : 0;
    const canvas = document.createElement('canvas');
    const base = design.size;
    canvas.width = base;
    canvas.height = base + labelHeight;
    const ctx = canvas.getContext('2d');
    const cells = count + margin * 2;
    const qrArea = base;
    const cell = qrArea / cells;

    if (!design.transparent) {
      ctx.fillStyle = design.light;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const moduleCanvas = document.createElement('canvas');
    moduleCanvas.width = qrArea;
    moduleCanvas.height = qrArea;
    const mctx = moduleCanvas.getContext('2d');

    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!qr.isDark(row, col)) continue;
        if (isFinder(row, col, count)) continue;
        const x = Math.round((col + margin) * cell);
        const y = Math.round((row + margin) * cell);
        mctx.fillStyle = '#000';
        drawModule(mctx, x, y, Math.ceil(cell), design.moduleStyle);
      }
    }

    if (design.gradient) {
      const grad = design.gradientRadial
        ? mctx.createRadialGradient(qrArea / 2, qrArea / 2, 0, qrArea / 2, qrArea / 2, qrArea / 2)
        : mctx.createLinearGradient(0, 0, qrArea, qrArea);
      grad.addColorStop(0, design.dark);
      grad.addColorStop(1, design.gradientColor);
      mctx.globalCompositeOperation = 'source-in';
      mctx.fillStyle = grad;
      mctx.fillRect(0, 0, qrArea, qrArea);
    } else {
      mctx.globalCompositeOperation = 'source-in';
      mctx.fillStyle = design.dark;
      mctx.fillRect(0, 0, qrArea, qrArea);
    }
    mctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(moduleCanvas, 0, 0);

    const borderColor = design.customMarkers ? design.markerBorder : design.dark;
    const centerColor = design.customMarkers ? design.markerCenter : design.dark;
    const corners = [
      ['tl', margin, margin],
      ['tr', margin + count - 7, margin],
      ['bl', margin, margin + count - 7]
    ];
    corners.forEach(([, fx, fy]) => {
      drawFinder(ctx, Math.round(fx * cell), Math.round(fy * cell), cell, design.markerStyle, borderColor, centerColor);
    });

    if (logoImage) {
      const logoSize = qrArea * 0.18;
      const lx = (qrArea - logoSize) / 2;
      const ly = (qrArea - logoSize) / 2;
      if (design.logoPad) {
        ctx.fillStyle = design.transparent ? '#ffffff' : design.light;
        ctx.fillRect(lx - 8, ly - 8, logoSize + 16, logoSize + 16);
      }
      ctx.drawImage(logoImage, lx, ly, logoSize, logoSize);
    }

    if (design.frameLabel) {
      ctx.fillStyle = design.dark;
      ctx.font = '600 18px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(design.frameLabel, canvas.width / 2, qrArea + 28);
    }

    return canvas;
  }

  function encodeQr(text, ecc) {
    const qr = qrcode(0, ecc || 'M');
    qr.addData(text);
    qr.make();
    return qr;
  }

  function setDownloads(enabled) {
    downloadPng.disabled = !enabled;
    downloadJpg.disabled = !enabled;
    downloadSvg.disabled = !enabled;
    copyPayloadBtn.disabled = !enabled;
  }

  function showPreview(canvas) {
    preview.innerHTML = '';
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    preview.appendChild(canvas);
  }

  function generateQr(silent) {
    statusEl.className = 'status';
    try {
      const payload = buildPayload();
      const design = getDesign();
      const qr = encodeQr(payload, design.ecc);
      lastPayload = payload;
      lastQr = qr;
      const canvas = renderStyledQr(qr, design);
      showPreview(canvas);
      setDownloads(true);
      if (!silent) {
        statusEl.textContent = 'QR code ready. Test it before printing.';
        statusEl.classList.add('success');
      }
    } catch (error) {
      if (!silent) {
        statusEl.textContent = error.message;
        statusEl.classList.add('error');
      }
      setDownloads(false);
    }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => generateQr(true), 350);
  }

  function renderTypeTabs() {
    typeTabs.innerHTML = QR_TYPES.map((t) =>
      `<button type="button" class="type-tab${t.id === activeType ? ' is-active' : ''}" role="tab" aria-selected="${t.id === activeType}" data-type="${t.id}"><span class="tab-icon" aria-hidden="true">${t.icon}</span>${t.label}</button>`
    ).join('');
    typeTabs.querySelectorAll('.type-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeType = btn.dataset.type;
        renderTypeTabs();
        renderFields();
        schedulePreview();
      });
    });
  }

  function renderFields() {
    fields.innerHTML = fieldHtml(activeType);
    fields.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', schedulePreview);
      el.addEventListener('change', schedulePreview);
    });
    schedulePreview();
  }

  function getCanvas() {
    return preview.querySelector('canvas');
  }

  function downloadBlob(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  downloadPng.addEventListener('click', () => {
    const canvas = getCanvas();
    if (!canvas) return;
    downloadBlob(canvas.toDataURL('image/png'), 'getqrcode.png');
  });

  downloadJpg.addEventListener('click', () => {
    const canvas = getCanvas();
    if (!canvas) return;
    downloadBlob(canvas.toDataURL('image/jpeg', 0.92), 'getqrcode.jpg');
  });

  downloadSvg.addEventListener('click', () => {
    if (!lastQr) return;
    const design = getDesign();
    const cell = Math.max(4, Math.floor(design.size / (lastQr.getModuleCount() + 8)));
    let svg = lastQr.createSvgTag(cell, 4, 'QR code');
    if (design.dark !== '#000000' || design.light !== '#ffffff') {
      svg = svg.replace(/#000000/g, design.dark).replace(/#ffffff/g, design.transparent ? 'none' : design.light);
    }
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'getqrcode.svg';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  copyPayloadBtn.addEventListener('click', async () => {
    if (!lastPayload) return;
    try {
      await navigator.clipboard.writeText(lastPayload);
      statusEl.textContent = 'Encoded data copied to clipboard.';
      statusEl.className = 'status success';
    } catch {
      statusEl.textContent = 'Could not copy. Select and copy manually.';
      statusEl.className = 'status error';
    }
  });

  document.getElementById('logo-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      logoImage = null;
      schedulePreview();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        logoImage = img;
        schedulePreview();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  ['gradient-enable', 'custom-marker-colors', 'transparent-bg'].forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      if (id === 'gradient-enable') {
        document.getElementById('gradient-color').disabled = !e.target.checked;
        document.getElementById('gradient-radial').disabled = !e.target.checked;
      }
      if (id === 'custom-marker-colors') {
        document.getElementById('marker-border-color').disabled = !e.target.checked;
        document.getElementById('marker-center-color').disabled = !e.target.checked;
      }
      if (id === 'transparent-bg') {
        document.getElementById('light-color').disabled = e.target.checked;
      }
      schedulePreview();
    });
  });

  document.querySelectorAll('#qr-form input, #qr-form select').forEach((el) => {
    if (el.id === 'logo-file') return;
    el.addEventListener('input', schedulePreview);
    el.addEventListener('change', schedulePreview);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    generateQr(false);
  });

  renderTypeTabs();
  renderFields();
})();
