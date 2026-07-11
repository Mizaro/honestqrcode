# Contributing

Thanks for helping improve Honest QR Code.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue first for large UI changes, new dependencies, analytics, or anything that changes the privacy model.
3. Never include credentials, production configuration secrets, personal QR payloads, or third-party assets without a compatible license.

## Development

The project uses plain HTML, CSS, and JavaScript. Serve the repository root with any static server:

```bash
python -m http.server 8080
```

Test at desktop and mobile widths. At minimum, verify:

- website, WiFi, WhatsApp, vCard, and event payloads;
- PNG, JPG, and SVG downloads;
- keyboard navigation and visible focus states;
- no console errors or unexpected network requests;
- canonical, robots, sitemap, and social metadata after SEO changes.

## Pull requests

Keep changes focused and explain the user impact. Include screenshots for visual changes and update documentation when behavior changes. By contributing, you agree that your contribution is licensed under Apache-2.0.
