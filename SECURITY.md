# Security policy

## Supported version

The current `main` branch and the production deployment at <https://honestqrcode.com/> are supported.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/Mizaro/honestqrcode/security/advisories/new). Do not open a public issue for a vulnerability that could put users at risk.

Include the affected file or URL, reproduction steps, impact, and any suggested mitigation. You should receive an acknowledgement within seven days. Please allow reasonable time for a fix before public disclosure.

## Scope

The app is static and intentionally makes no request with a user's QR payload. Reports about payload leakage, unsafe image handling, generated-code integrity, cross-site scripting, deployment headers, or supply-chain changes are especially useful.
