const form = document.getElementById('qr-form');
const typeSelect = document.getElementById('qr-type');
const fields = document.getElementById('dynamic-fields');
const statusEl = document.getElementById('status');
const preview = document.getElementById('qr-preview');
const downloadPng = document.getElementById('download-png');
const downloadSvg = document.getElementById('download-svg');

function fieldHtml(type) {
  if (type === 'wifi') {
    return `
      <label for="ssid">WiFi network name</label>
      <input id="ssid" name="ssid" autocomplete="off" placeholder="My WiFi Network" required>
      <label for="wifi-password">WiFi password</label>
      <input id="wifi-password" name="wifi-password" type="text" autocomplete="off" placeholder="Password">
      <label for="wifi-encryption">Security</label>
      <select id="wifi-encryption" name="wifi-encryption">
        <option value="WPA">WPA/WPA2</option>
        <option value="WEP">WEP</option>
        <option value="nopass">No password</option>
      </select>
      <label class="checkbox-row"><input id="wifi-hidden" type="checkbox"> Hidden network</label>
    `;
  }

  if (type === 'whatsapp') {
    return `
      <label for="phone">WhatsApp phone number</label>
      <input id="phone" name="phone" inputmode="tel" placeholder="+15551234567" required>
      <p class="field-help">Use country code. Example: +1 for the US.</p>
      <label for="message">Optional message</label>
      <textarea id="message" name="message" placeholder="Hi, I am interested in..."></textarea>
    `;
  }

  const labels = {
    website: ['Website URL', 'https://example.com'],
    pdf: ['PDF URL', 'https://example.com/file.pdf'],
    image: ['Image URL', 'https://example.com/image.jpg'],
    video: ['Video URL', 'https://example.com/video']
  };
  const selected = labels[type] || labels.website;
  return `
    <label for="url-input">${selected[0]}</label>
    <input id="url-input" name="url-input" inputmode="url" placeholder="${selected[1]}" required>
    <p class="field-help">Paste a full link, or type a domain and we will add https automatically.</p>
  `;
}

function renderFields() {
  fields.innerHTML = fieldHtml(typeSelect.value);
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function escapeWifi(value) {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

function buildPayload() {
  const type = typeSelect.value;

  if (type === 'wifi') {
    const ssid = document.getElementById('ssid').value.trim();
    const password = document.getElementById('wifi-password').value;
    const encryption = document.getElementById('wifi-encryption').value;
    const hidden = document.getElementById('wifi-hidden').checked ? 'true' : 'false';
    if (!ssid) throw new Error('Enter the WiFi network name.');
    return `WIFI:T:${encryption};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${hidden};;`;
  }

  if (type === 'whatsapp') {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
    const message = document.getElementById('message').value.trim();
    if (!phone) throw new Error('Enter a WhatsApp phone number with country code.');
    return message ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/${phone}`;
  }

  const url = document.getElementById('url-input').value.trim();
  if (!url) throw new Error('Enter a link.');
  return normalizeUrl(url);
}

function generateFallback(payload) {
  preview.innerHTML = '';
  const box = document.createElement('div');
  box.style.padding = '1rem';
  box.style.wordBreak = 'break-word';
  box.innerHTML = `<strong>QR payload ready</strong><p>${payload.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</p><p>Add the local QR library file to render the visual code.</p>`;
  preview.appendChild(box);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  statusEl.className = 'status';
  try {
    const payload = buildPayload();
    preview.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(preview, {
        text: payload,
        width: Number(document.getElementById('qr-size').value),
        height: Number(document.getElementById('qr-size').value),
        colorDark: document.getElementById('dark-color').value,
        colorLight: document.getElementById('light-color').value,
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : undefined
      });
      downloadPng.disabled = false;
      downloadSvg.disabled = false;
      statusEl.textContent = 'QR code generated. Test it before printing.';
      statusEl.classList.add('success');
    } else {
      generateFallback(payload);
      statusEl.textContent = 'Payload created, but the QR rendering library is missing.';
      statusEl.classList.add('error');
    }
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add('error');
  }
});

typeSelect.addEventListener('change', renderFields);
renderFields();
