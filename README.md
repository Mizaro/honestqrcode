# Get QR Code

Free permanent QR codes with no signup, no expiration, and no tracking by default.

Get QR Code is a privacy-first, client-side QR code generator designed for trust, simplicity, and strong SEO. All core features are free.

## Core promise

- Static QR codes that do not expire
- No forced redirects
- No account required
- No hidden paywalls
- No trial traps
- Generated locally in your browser
- Commercial use allowed

## Features

Everything below is free:

- Website QR codes
- PDF link QR codes
- Video link QR codes
- WhatsApp message QR codes
- Image link QR codes
- WiFi QR codes
- PNG downloads
- SVG downloads
- Custom colors
- QR size options
- Error correction options
- Mobile-friendly generation

## UX principles

The product follows these principles:

- Simple first, advanced options second
- Fast generation without signup friction
- Static QR first, permanent by default
- Trust messaging near the top of the page
- Clear download flow
- Accessible, mobile-first design

## Privacy and security model

This project runs entirely in the browser. QR payloads are generated locally and are not sent to a server by the app.

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

The donation button is optional and supports hosting and maintenance. Replace the placeholder link in index.html with your own Buy Me a Coffee URL.

## Public repo safety

Do not commit API keys, analytics tokens, private domain credentials, payment secrets, or private service credentials. This app does not require secrets.
