(function () {
  'use strict';

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
      const r = typeof radius === 'number' ? radius : 0;
      this.moveTo(x + r, y);
      this.arcTo(x + width, y, x + width, y + height, r);
      this.arcTo(x + width, y + height, x, y + height, r);
      this.arcTo(x, y + height, x, y, r);
      this.arcTo(x, y, x + width, y, r);
      this.closePath();
    };
  }

  const QR_TYPES = [
    { id: 'link', label: 'Website link', group: 'Popular', help: 'Open any website or landing page.' },
    { id: 'wifi', label: 'WiFi network', group: 'Popular', help: 'Help people join your network instantly.' },
    { id: 'whatsapp', label: 'WhatsApp', group: 'Popular', help: 'Start a WhatsApp chat with an optional message.' },
    { id: 'vcard', label: 'Contact card (vCard)', group: 'Popular', help: 'Share a saveable contact card.' },
    { id: 'email', label: 'Email', group: 'Popular', help: 'Open a drafted email with subject and body.' },
    { id: 'text', label: 'Plain text', group: 'Popular', help: 'Encode any short message or note.' },
    { id: 'phone', label: 'Phone call', group: 'Contact', help: 'Dial a number directly.' },
    { id: 'sms', label: 'SMS', group: 'Contact', help: 'Prefill an SMS message.' },
    { id: 'social', label: 'Social profile', group: 'Contact', help: 'Send visitors to a public profile.' },
    { id: 'location', label: 'Map location', group: 'More', help: 'Share coordinates or a place.' },
    { id: 'event', label: 'Calendar event', group: 'More', help: 'Create a scannable event invite.' },
    { id: 'skype', label: 'Skype', group: 'More', help: 'Open a Skype chat or call.' },
    { id: 'zoom', label: 'Zoom meeting', group: 'More', help: 'Jump into a Zoom meeting link.' },
    { id: 'paypal', label: 'PayPal', group: 'More', help: 'Request a payment with PayPal.' },
    { id: 'bitcoin', label: 'Bitcoin', group: 'More', help: 'Share a Bitcoin payment request.' },
    { id: 'pdf', label: 'PDF file link', group: 'Media', help: 'Link to a hosted PDF file.' },
    { id: 'image', label: 'Image link', group: 'Media', help: 'Open an image URL.' },
    { id: 'video', label: 'Video link', group: 'Media', help: 'Open a video or hosted clip.' }
  ];

  const QUICK_TYPES = ['link', 'wifi', 'whatsapp', 'vcard', 'email', 'text'];
  const TYPE_BY_ID = Object.fromEntries(QR_TYPES.map((type) => [type.id, type]));

  const DEFAULTS = {
    link: { 'url-input': 'https://example.com' },
    text: { 'text-message': 'Hello, scan me!' },
    email: { 'email-to': 'hello@example.com', 'email-subject': 'Hello' },
    phone: { 'phone-number': '5551234567' },
    sms: { 'sms-number': '5551234567', 'sms-body': 'Hello' },
    whatsapp: { 'wa-number': '5551234567', 'wa-message': 'Hello!' },
    wifi: { ssid: 'MyNetwork', 'wifi-password': 'password123' },
    vcard: { 'vcard-first': 'Jane', 'vcard-last': 'Doe', 'vcard-email': 'jane@example.com', 'vcard-phone': '+15551234567' },
    location: { 'geo-lat': '40.7128', 'geo-lng': '-74.0060', 'geo-label': 'New York' },
    skype: { 'skype-user': 'username' },
    zoom: { 'zoom-id': '123456789', 'zoom-pwd': 'hello123' },
    event: { 'event-title': 'Meeting' },
    paypal: { 'pp-email': 'pay@example.com', 'pp-amount': '10' },
    bitcoin: { 'btc-address': 'bc1qexampleaddress', 'btc-amount': '0.01' },
    social: { 'social-handle': 'brand' },
    pdf: { 'url-input': 'https://example.com/file.pdf' },
    image: { 'url-input': 'https://example.com/photo.jpg' },
    video: { 'url-input': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
  };

  const form = document.getElementById('qr-form');
  const typeSelect = document.getElementById('qr-type-select');
  const quickTypes = document.getElementById('quick-types');
  const fields = document.getElementById('dynamic-fields');
  const preview = document.getElementById('qr-preview');
  const previewEmpty = document.getElementById('preview-empty');
  const previewBadge = document.getElementById('preview-badge');
  const contentHeading = document.getElementById('content-heading');
  const contentHelp = document.getElementById('content-help');
  const statusEl = document.getElementById('status');
  const downloadPng = document.getElementById('download-png');
  const downloadJpg = document.getElementById('download-jpg');
  const downloadSvg = document.getElementById('download-svg');
  const copyPayloadBtn = document.getElementById('copy-payload');
  const generateBtn = document.getElementById('generate-qr');
  const previewPanel = document.getElementById('preview-panel');

  let activeType = 'link';
  let debounceTimer = null;
  let lastPayload = '';
  let lastQr = null;
  let lastCanvas = null;
  let lastDesign = null;
  let logoState = { image: null, dataUrl: '' };

  function $(id) {
    return document.getElementById(id);
  }

  function valueOf(id) {
    const element = $(id);
    return element ? String(element.value).trim() : '';
  }

  function checked(id) {
    const element = $(id);
    return element ? element.checked : false;
  }

  function escapeXml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    const date = new Date(localValue);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  }

  function toLocalInput(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function phoneE164(codeId, numId) {
    const code = valueOf(codeId).replace(/\s/g, '') || '+1';
    const number = valueOf(numId).replace(/[^\d]/g, '');
    return number ? `${code}${number}` : '';
  }

  function getQrFactory() {
    if (typeof window.qrcode === 'function') return window.qrcode;
    if (typeof qrcode === 'function') return qrcode;
    throw new Error('QR engine failed to load. Refresh the page and try again.');
  }

  function countrySelect(id) {
    const codes = ['+1', '+44', '+61', '+49', '+33', '+91', '+86', '+81', '+55'];
    return `<select id="${id}" class="input-compact">${codes.map((code) => `<option value="${code}">${code}</option>`).join('')}</select>`;
  }

  function fieldsFor(type) {
    const cc = countrySelect;
    const fieldMap = {
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
      paypal: `<label for="pp-email">PayPal email</label><input id="pp-email" type="email"><label for="pp-item">Item name (optional)</label><input id="pp-item"><label for="pp-amount">Amount</label><input id="pp-amount" inputmode="decimal" placeholder="10.00">`,
      bitcoin: `<label for="btc-address">Bitcoin address</label><input id="btc-address"><label for="btc-amount">Amount BTC (optional)</label><input id="btc-amount" inputmode="decimal">`,
      social: `<label for="social-platform">Platform</label><select id="social-platform"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="x">X</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select><label for="social-handle">Username</label><input id="social-handle" placeholder="brand">`,
      pdf: `<label for="url-input">PDF URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://example.com/file.pdf">`,
      image: `<label for="url-input">Image URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://example.com/photo.jpg">`,
      video: `<label for="url-input">Video URL</label><input id="url-input" type="url" inputmode="url" placeholder="https://youtube.com/...">`
    };

    return fieldMap[type] || fieldMap.link;
  }

  function applyDefaults(type) {
    const defaults = DEFAULTS[type] || {};
    Object.entries(defaults).forEach(([id, value]) => {
      const element = $(id);
      if (element && !element.value) {
        element.value = value;
      }
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

  function buildPayload() {
    const type = activeType;

    if (type === 'link' || type === 'pdf' || type === 'image' || type === 'video') {
      const url = valueOf('url-input');
      if (!url) throw new Error('Enter a URL to generate your QR code.');
      return normalizeUrl(url);
    }

    if (type === 'text') {
      const text = valueOf('text-message');
      if (!text) throw new Error('Enter the text you want to encode.');
      return text;
    }

    if (type === 'email') {
      const to = valueOf('email-to');
      if (!to) throw new Error('Enter an email address.');
      const params = new URLSearchParams();
      if (valueOf('email-subject')) params.set('subject', valueOf('email-subject'));
      if (valueOf('email-body')) params.set('body', valueOf('email-body'));
      const query = params.toString();
      return query ? `mailto:${to}?${query}` : `mailto:${to}`;
    }

    if (type === 'location') {
      const lat = valueOf('geo-lat');
      const lng = valueOf('geo-lng');
      if (!lat || !lng) throw new Error('Enter both latitude and longitude.');
      const label = valueOf('geo-label');
      return label ? `geo:${lat},${lng}?q=${encodeURIComponent(label)}` : `geo:${lat},${lng}`;
    }

    if (type === 'phone') {
      const phone = phoneE164('phone-code', 'phone-number');
      if (!phone) throw new Error('Enter a phone number.');
      return `tel:${phone}`;
    }

    if (type === 'sms') {
      const phone = phoneE164('sms-code', 'sms-number');
      if (!phone) throw new Error('Enter a phone number.');
      const body = valueOf('sms-body');
      return body ? `sms:${phone}?body=${encodeURIComponent(body)}` : `sms:${phone}`;
    }

    if (type === 'whatsapp') {
      const phone = phoneE164('wa-code', 'wa-number').replace(/^\+/, '');
      if (!phone) throw new Error('Enter a WhatsApp number.');
      const message = valueOf('wa-message');
      return message ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/${phone}`;
    }

    if (type === 'skype') {
      const user = valueOf('skype-user');
      if (!user) throw new Error('Enter a Skype username.');
      const mode = document.querySelector('input[name="skype-action"]:checked');
      return `skype:${user}?${mode && mode.value === 'call' ? 'call' : 'chat'}`;
    }

    if (type === 'zoom') {
      const meetingId = valueOf('zoom-id').replace(/\s/g, '');
      if (!meetingId) throw new Error('Enter a Zoom meeting ID.');
      const password = valueOf('zoom-pwd');
      return password ? `https://zoom.us/j/${meetingId}?pwd=${encodeURIComponent(password)}` : `https://zoom.us/j/${meetingId}`;
    }

    if (type === 'wifi') {
      const ssid = valueOf('ssid');
      if (!ssid) throw new Error('Enter your WiFi network name.');
      const encryption = valueOf('wifi-encryption') || 'WPA';
      const password = valueOf('wifi-password');
      const hidden = checked('wifi-hidden');
      const hiddenSuffix = hidden ? ';H:true' : '';
      const passwordSegment = encryption === 'nopass' ? '' : `;P:${password}`;
      return `WIFI:T:${encryption};S:${ssid}${passwordSegment}${hiddenSuffix};;`;
    }

    if (type === 'vcard') {
      const first = valueOf('vcard-first');
      if (!first) throw new Error('Enter at least a first name.');
      const last = valueOf('vcard-last');
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapeVcard(`${first} ${last}`.trim())}`,
        `N:${escapeVcard(last)};${escapeVcard(first)};;;`
      ];
      if (valueOf('vcard-org')) lines.push(`ORG:${escapeVcard(valueOf('vcard-org'))}`);
      if (valueOf('vcard-phone')) lines.push(`TEL:${escapeVcard(valueOf('vcard-phone'))}`);
      if (valueOf('vcard-email')) lines.push(`EMAIL:${escapeVcard(valueOf('vcard-email'))}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }

    if (type === 'event') {
      const title = valueOf('event-title');
      if (!title) throw new Error('Enter an event title.');
      const start = toIcalDate(valueOf('event-start'));
      if (!start) throw new Error('Pick a valid start date.');
      const end = toIcalDate(valueOf('event-end')) || start;
      const lines = ['BEGIN:VEVENT', `SUMMARY:${escapeVcard(title)}`, `DTSTART:${start}`, `DTEND:${end}`];
      if (valueOf('event-location')) lines.push(`LOCATION:${escapeVcard(valueOf('event-location'))}`);
      lines.push('END:VEVENT');
      return lines.join('\n');
    }

    if (type === 'paypal') {
      const email = valueOf('pp-email');
      if (!email) throw new Error('Enter your PayPal email.');
      const params = new URLSearchParams({ cmd: '_xclick', business: email, currency_code: 'USD' });
      if (valueOf('pp-item')) params.set('item_name', valueOf('pp-item'));
      if (valueOf('pp-amount')) params.set('amount', valueOf('pp-amount'));
      return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
    }

    if (type === 'bitcoin') {
      const address = valueOf('btc-address');
      if (!address) throw new Error('Enter a Bitcoin address.');
      const params = new URLSearchParams();
      if (valueOf('btc-amount')) params.set('amount', valueOf('btc-amount'));
      const query = params.toString();
      return query ? `bitcoin:${address}?${query}` : `bitcoin:${address}`;
    }

    if (type === 'social') {
      const handle = valueOf('social-handle').replace(/^@/, '');
      if (!handle) throw new Error('Enter a username.');
      const bases = {
        instagram: 'https://instagram.com/',
        facebook: 'https://facebook.com/',
        x: 'https://x.com/',
        linkedin: 'https://www.linkedin.com/in/',
        tiktok: 'https://tiktok.com/@',
        youtube: 'https://youtube.com/@'
      };
      return `${bases[valueOf('social-platform')] || bases.instagram}${handle}`;
    }

    throw new Error('Unsupported QR type.');
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
      frameLabel: valueOf('frame-label')
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
      ctx.roundRect(x, y, size, size, size * 0.24);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.fill();
  }

  function drawFinder(ctx, x, y, cell, dark, light) {
    const size = cell * 7;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, cell * 1.15);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.roundRect(x + cell, y + cell, cell * 5, cell * 5, cell * 0.8);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * 0.5);
    ctx.fill();
  }

  function renderQr(payload, design) {
    const createQr = getQrFactory();
    const qr = createQr(0, design.ecc);
    qr.addData(payload);
    qr.make();

    const count = qr.getModuleCount();
    const quietZone = 4;
    const labelHeight = design.frameLabel ? 36 : 0;
    const canvas = document.createElement('canvas');
    canvas.width = design.size;
    canvas.height = design.size + labelHeight;

    const ctx = canvas.getContext('2d');
    const cell = design.size / (count + quietZone * 2);
    const layer = document.createElement('canvas');
    layer.width = design.size;
    layer.height = design.size;
    const layerCtx = layer.getContext('2d');

    if (!design.transparent) {
      ctx.fillStyle = design.light;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!qr.isDark(row, col) || isFinder(row, col, count)) continue;
        const x = Math.round((col + quietZone) * cell);
        const y = Math.round((row + quietZone) * cell);
        layerCtx.fillStyle = '#000000';
        drawModule(layerCtx, x, y, Math.max(1, Math.ceil(cell)), design.moduleStyle);
      }
    }

    layerCtx.globalCompositeOperation = 'source-in';
    if (design.gradient) {
      const gradient = layerCtx.createLinearGradient(0, 0, design.size, design.size);
      gradient.addColorStop(0, design.dark);
      gradient.addColorStop(1, design.gradientColor);
      layerCtx.fillStyle = gradient;
    } else {
      layerCtx.fillStyle = design.dark;
    }
    layerCtx.fillRect(0, 0, design.size, design.size);
    layerCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(layer, 0, 0);

    const finderLight = design.transparent ? '#ffffff' : design.light;
    const finderOffsets = [
      [quietZone, quietZone],
      [quietZone + count - 7, quietZone],
      [quietZone, quietZone + count - 7]
    ];
    finderOffsets.forEach(([fx, fy]) => {
      drawFinder(ctx, Math.round(fx * cell), Math.round(fy * cell), cell, design.dark, finderLight);
    });

    if (logoState.image) {
      const logoSize = design.size * 0.2;
      const x = (design.size - logoSize) / 2;
      const y = (design.size - logoSize) / 2;
      ctx.fillStyle = finderLight;
      ctx.fillRect(x - 6, y - 6, logoSize + 12, logoSize + 12);
      ctx.drawImage(logoState.image, x, y, logoSize, logoSize);
    }

    if (design.frameLabel) {
      ctx.fillStyle = design.dark;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(design.frameLabel, design.size / 2, design.size + 20);
    }

    return { canvas, qr };
  }

  function svgModuleMarkup(x, y, size, style, fill) {
    if (style === 'dot') {
      const radius = size * 0.42;
      return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${radius}" fill="${fill}" />`;
    }
    if (style === 'rounded') {
      return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.24}" fill="${fill}" />`;
    }
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${fill}" />`;
  }

  function svgFinderMarkup(x, y, cell, darkFill, lightFill) {
    const size = cell * 7;
    return [
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${cell * 1.15}" fill="${darkFill}" />`,
      `<rect x="${x + cell}" y="${y + cell}" width="${cell * 5}" height="${cell * 5}" rx="${cell * 0.8}" fill="${lightFill}" />`,
      `<rect x="${x + cell * 2}" y="${y + cell * 2}" width="${cell * 3}" height="${cell * 3}" rx="${cell * 0.5}" fill="${darkFill}" />`
    ].join('');
  }

  function buildSvg(qr, design) {
    const count = qr.getModuleCount();
    const quietZone = 4;
    const size = design.size;
    const labelHeight = design.frameLabel ? 36 : 0;
    const cell = size / (count + quietZone * 2);
    const darkFill = design.gradient ? 'url(#qrGradient)' : design.dark;
    const lightFill = design.transparent ? '#ffffff' : design.light;
    const markup = [];

    if (!design.transparent) {
      markup.push(`<rect width="${size}" height="${size + labelHeight}" fill="${design.light}" />`);
    }

    if (design.gradient) {
      markup.push(`<defs><linearGradient id="qrGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${design.dark}" /><stop offset="100%" stop-color="${design.gradientColor}" /></linearGradient></defs>`);
    }

    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!qr.isDark(row, col) || isFinder(row, col, count)) continue;
        const x = (col + quietZone) * cell;
        const y = (row + quietZone) * cell;
        markup.push(svgModuleMarkup(x, y, cell, design.moduleStyle, darkFill));
      }
    }

    const finderOffsets = [
      [quietZone, quietZone],
      [quietZone + count - 7, quietZone],
      [quietZone, quietZone + count - 7]
    ];
    finderOffsets.forEach(([fx, fy]) => {
      markup.push(svgFinderMarkup(fx * cell, fy * cell, cell, darkFill, lightFill));
    });

    if (logoState.dataUrl) {
      const logoSize = size * 0.2;
      const x = (size - logoSize) / 2;
      const y = (size - logoSize) / 2;
      markup.push(`<rect x="${x - 6}" y="${y - 6}" width="${logoSize + 12}" height="${logoSize + 12}" fill="${lightFill}" />`);
      markup.push(`<image href="${logoState.dataUrl}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" />`);
    }

    if (design.frameLabel) {
      markup.push(`<text x="${size / 2}" y="${size + 22}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="${design.dark}">${escapeXml(design.frameLabel)}</text>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + labelHeight}" viewBox="0 0 ${size} ${size + labelHeight}" role="img" aria-label="QR code">${markup.join('')}</svg>`;
  }

  function setBadge(state, text) {
    previewBadge.className = `badge badge-${state}`;
    previewBadge.textContent = text;
  }

  function setDownloads(enabled) {
    downloadPng.disabled = !enabled;
    downloadJpg.disabled = !enabled;
    downloadSvg.disabled = !enabled;
    copyPayloadBtn.disabled = !enabled;
  }

  function showCanvas(canvas) {
    preview.querySelectorAll('canvas').forEach((node) => node.remove());
    previewEmpty.hidden = true;
    canvas.className = 'qr-canvas';
    preview.appendChild(canvas);
    lastCanvas = canvas;
  }

  function showEmpty(message) {
    preview.querySelectorAll('canvas').forEach((node) => node.remove());
    previewEmpty.hidden = false;
    previewEmpty.querySelector('p').textContent = message || 'Your QR code will appear here.';
    lastCanvas = null;
    setDownloads(false);
  }

  function updatePreview() {
    statusEl.textContent = '';
    statusEl.className = 'status';

    try {
      const payload = buildPayload();
      const design = getDesign();
      const result = renderQr(payload, design);

      lastPayload = payload;
      lastQr = result.qr;
      lastDesign = design;

      showCanvas(result.canvas);
      setDownloads(true);
      setBadge('ready', 'Ready');
      statusEl.textContent = 'Live preview is ready. Scan with your phone before printing.';
      statusEl.className = 'status status-ok';
    } catch (error) {
      lastPayload = '';
      lastQr = null;
      lastDesign = null;
      showEmpty(error.message);
      setBadge('warn', 'Needs input');
      statusEl.textContent = error.message;
      statusEl.className = 'status status-warn';
    }
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 250);
  }

  function isMobileLayout() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function scrollToPreview() {
    if (!previewPanel) return;
    previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleGenerate() {
    clearTimeout(debounceTimer);
    updatePreview();
    if (lastCanvas && isMobileLayout()) {
      scrollToPreview();
    }
  }

  function bindDynamicFields() {
    fields.querySelectorAll('input, textarea, select').forEach((element) => {
      element.addEventListener('input', scheduleUpdate);
      element.addEventListener('change', scheduleUpdate);
    });
  }

  function renderTypeSelect() {
    const groups = [...new Set(QR_TYPES.map((type) => type.group))];
    typeSelect.innerHTML = groups.map((group) => {
      const options = QR_TYPES
        .filter((type) => type.group === group)
        .map((type) => `<option value="${type.id}">${type.label}</option>`)
        .join('');
      return `<optgroup label="${group}">${options}</optgroup>`;
    }).join('');
    typeSelect.value = activeType;
  }

  function renderQuickTypes() {
    quickTypes.innerHTML = QUICK_TYPES.map((id) => {
      const type = TYPE_BY_ID[id];
      return `<button type="button" class="quick-type${id === activeType ? ' is-active' : ''}" data-type="${id}">${type.label}</button>`;
    }).join('');

    quickTypes.querySelectorAll('.quick-type').forEach((button) => {
      button.addEventListener('click', () => setType(button.dataset.type));
    });
  }

  function setType(type) {
    activeType = type;
    typeSelect.value = type;
    contentHeading.textContent = TYPE_BY_ID[type].label;
    contentHelp.textContent = TYPE_BY_ID[type].help;
    fields.innerHTML = fieldsFor(type);
    renderQuickTypes();
    applyDefaults(type);
    bindDynamicFields();
    updatePreview();
  }

  function bindCustomizeInputs() {
    $('gradient-enable').addEventListener('change', (event) => {
      $('gradient-color').disabled = !event.target.checked;
      scheduleUpdate();
    });

    $('transparent-bg').addEventListener('change', (event) => {
      $('light-color').disabled = event.target.checked;
      scheduleUpdate();
    });

    ['qr-size', 'qr-ecc', 'dark-color', 'light-color', 'gradient-color', 'module-style', 'frame-label'].forEach((id) => {
      $(id).addEventListener('input', scheduleUpdate);
      $(id).addEventListener('change', scheduleUpdate);
    });

    $('logo-file').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        logoState = { image: null, dataUrl: '' };
        scheduleUpdate();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          logoState = { image, dataUrl: reader.result };
          $('qr-ecc').value = 'H';
          scheduleUpdate();
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCurrentCanvas(format) {
    if (!lastCanvas) return;

    if (format === 'jpeg') {
      const jpgCanvas = document.createElement('canvas');
      jpgCanvas.width = lastCanvas.width;
      jpgCanvas.height = lastCanvas.height;
      const jpgContext = jpgCanvas.getContext('2d');
      jpgContext.fillStyle = '#ffffff';
      jpgContext.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
      jpgContext.drawImage(lastCanvas, 0, 0);
      const link = document.createElement('a');
      link.href = jpgCanvas.toDataURL('image/jpeg', 0.92);
      link.download = 'qrcode.jpg';
      link.click();
      return;
    }

    const link = document.createElement('a');
    link.href = lastCanvas.toDataURL('image/png');
    link.download = 'qrcode.png';
    link.click();
  }

  downloadPng.addEventListener('click', () => downloadCurrentCanvas('png'));
  downloadJpg.addEventListener('click', () => downloadCurrentCanvas('jpeg'));

  downloadSvg.addEventListener('click', () => {
    if (!lastQr || !lastDesign) return;
    downloadBlob(new Blob([buildSvg(lastQr, lastDesign)], { type: 'image/svg+xml' }), 'qrcode.svg');
  });

  copyPayloadBtn.addEventListener('click', async () => {
    if (!lastPayload) return;
    try {
      await navigator.clipboard.writeText(lastPayload);
      statusEl.textContent = 'Copied encoded data to clipboard.';
      statusEl.className = 'status status-ok';
    } catch (error) {
      statusEl.textContent = 'Copy failed. Select the source value manually instead.';
      statusEl.className = 'status status-warn';
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleGenerate();
  });
  typeSelect.addEventListener('change', () => setType(typeSelect.value));
  generateBtn.addEventListener('click', handleGenerate);

  renderTypeSelect();
  renderQuickTypes();
  bindCustomizeInputs();
  setType('link');
})();
