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
      <input id="ssid" placeholder="My WiFi Network" required>
      <label for="wifi-password">WiFi password</label>
      <input id="wifi-password" type="text" placeholder="Password">
      <label for="wifi-encryption">Security</label>
      <select id="wifi-encryption">
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
      <input id="phone" inputmode="tel" placeholder="+15551234567" required>
      <label for="message">Optional message</label>
      <textarea id="message" placeholder="Hi, I am interested in..."></textarea>
    `;
  }

  const map = {
    website: ['Website URL', 'https://example.com'],
    pdf: ['PDF URL', 'https://example.com/file.pdf'],
    image: ['Image URL', 'https://example.com/image.jpg'],
    video: ['Video URL', 'https://example.com/video']
  };

  const selected = map[type] || map.website;
  return `
    <label for="url-input">${selected[0]}</label>
    <input id="url-input" inputmode="url" placeholder="${selected[1]}" required>
  `;
}

function renderFields() {
  fields.innerHTML = fieldHtml(typeSelect.value);
}

function normalizeUrl(value) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function buildPayload() {
  const type = typeSelect.value;

  if (type === 'wifi') {
    const ssid = document.getElementById('ssid').value.trim();
    const password = document.getElementById('wifi-password').value;
    const encryption = document.getElementById('wifi-encryption').value;
    const hidden = document.getElementById('wifi-hidden').checked ? 'true' : 'false';
    if (!ssid) throw new Error('Enter WiFi name');
    return `WIFI:T:${encryption};S:${ssid};P:${password};H:${hidden};;`;
  }

  if (type === 'whatsapp') {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
    const message = document.getElementById('message').value.trim();
    if (!phone) throw new Error('Enter phone number');
    return message ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/${phone}`;
  }

  const url = document.getElementById('url-input').value.trim();
  if (!url) throw new Error('Enter a valid link');
  return normalizeUrl(url);
}

function downloadCanvas() {
  const canvas = preview.querySelector('canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'getqrcode.png';
  link.click();
}

downloadPng.addEventListener('click', downloadCanvas);
downloadSvg.addEventListener('click', () => {
  statusEl.textContent = 'SVG export will be added next. PNG works now.';
  statusEl.className = 'status';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  statusEl.className = 'status';
  try {
    const payload = buildPayload();
    preview.innerHTML = '';
    new QRCode(preview, {
      text: payload,
      width: Number(document.getElementById('qr-size').value),
      height: Number(document.getElementById('qr-size').value),
      colorDark: document.getElementById('dark-color').value,
      colorLight: document.getElementById('light-color').value
    });
    downloadPng.disabled = false;
    downloadSvg.disabled = false;
    statusEl.textContent = 'QR code generated successfully.';
    statusEl.classList.add('success');
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add('error');
  }
});

typeSelect.addEventListener('change', renderFields);
renderFields();
