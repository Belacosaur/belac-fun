# Infrastructure

Cloud resources are not provisioned. Do not create Railway or Cloudflare projects from this repository state.

## Response headers

Public static files should send:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` allowing the API origin plus embed hosts `https://www.youtube.com`, `https://www.youtube-nocookie.com`, `https://www.tiktok.com`, and `https://x.com` in `frame-src` only.

Admin API responses stay `Cache-Control: private, no-store`.

See `apps/web/public/_headers` for the Pages header file. It is not deployed.
