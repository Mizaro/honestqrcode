# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Get QR Code is a **zero-dependency static site**: `index.html`, `app.js`, `styles.css`, and vendored `qrcode-matrix.js`. All QR generation runs in the browser; there is no backend, database, or package manager.

### Running the app

From the repo root:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`. You can also open `index.html` directly via `file://`, but HTTP is closer to production.

Use a **tmux** session for the dev server so it stays running across agent steps (see README).

### Lint / test / build

There is **no** configured linter, test runner, or build step in this repo. Optional sanity checks:

- `node --check app.js` and `node --check qrcode-matrix.js` (syntax only)

### Hello-world verification

1. Start the static server on port **8080**.
2. Load the generator (`#generator`).
3. Default type **Website link** with URL `https://example.com` should show a QR in the preview and badge **READY**.
4. **Download PNG** / **Download SVG** / **Download JPG** should be enabled.

### Secrets

None required for local development (see README “Public repo safety”).
