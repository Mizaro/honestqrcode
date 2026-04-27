# Get QR Code

A fast, privacy-first, client-side QR code generator for common real-world use cases.

## Features

- Website QR codes
- PDF link QR codes
- Video link QR codes
- WhatsApp message QR codes
- Image link QR codes
- WiFi QR codes
- PNG and SVG downloads
- No backend required
- No account required
- No tracking by default
- Static hosting friendly

## Privacy and security model

This project is designed to run entirely in the browser. QR payloads are generated locally and are not sent to a server by the app.

Recommended deployment headers:

```txt
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

## Development

Open index.html directly, or serve the folder with any static server.

```bash
python3 -m http.server 8080
```

## Deployment

Upload the files to any static host, including Hostinger static hosting.

## Buy Me a Coffee

Replace the placeholder link in index.html with your own Buy Me a Coffee URL.

## Public repo safety

Do not commit API keys, analytics tokens, private domain credentials, or payment secrets. This app does not require secrets.
