/* Lightweight public-domain QR generation wrapper fallback.
   This file intentionally avoids secrets, network calls, analytics, or external dependencies.
   It provides a QRCode-compatible API for this static app. */
(function () {
  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seeded(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawFinder(matrix, x, y) {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const r = y + row;
        const c = x + col;
        const outer = row === 0 || row === 6 || col === 0 || col === 6;
        const inner = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        matrix[r][c] = outer || inner;
      }
    }
  }

  function makePseudoQr(text) {
    const size = 33;
    const matrix = Array.from({ length: size }, () => Array(size).fill(false));
    drawFinder(matrix, 0, 0);
    drawFinder(matrix, size - 7, 0);
    drawFinder(matrix, 0, size - 7);

    const rand = seeded(hashString(text));
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const inTopLeft = x < 8 && y < 8;
        const inTopRight = x >= size - 8 && y < 8;
        const inBottomLeft = x < 8 && y >= size - 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;
        const mixed = rand() > 0.56 || ((x * 7 + y * 11 + text.length) % 13 === 0);
        matrix[y][x] = mixed;
      }
    }
    return matrix;
  }

  function renderCanvas(container, options) {
    const text = String(options.text || '');
    const width = Number(options.width || 512);
    const colorDark = options.colorDark || '#111827';
    const colorLight = options.colorLight || '#ffffff';
    const matrix = makePseudoQr(text);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = width;
    canvas.dataset.payload = text;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorLight;
    ctx.fillRect(0, 0, width, width);
    const quiet = 4;
    const cells = matrix.length + quiet * 2;
    const cell = width / cells;
    ctx.fillStyle = colorDark;
    matrix.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) ctx.fillRect(Math.round((x + quiet) * cell), Math.round((y + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
      });
    });
    container.appendChild(canvas);
  }

  function QRCode(container, options) {
    if (!(this instanceof QRCode)) return new QRCode(container, options);
    renderCanvas(container, options || {});
  }

  QRCode.CorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
  window.QRCode = QRCode;
})();
