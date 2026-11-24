# SiteOpSync superadmin - DEV

A separate Cloudflare Pages project (for example `siteopsync.pages.dev`) from its own small GitHub repo containing this folder's contents:
`index.html`, `super.js`, `super.css` and the `functions` folder. The layout must be exactly:

```
index.html
super.css
super.js
functions/api/features.js
functions/api/super/clients.js
```

The file names and folders ARE the web addresses (`/api/features` and `/api/super/clients`), so a file in the wrong folder or with a different name gives a 404.

Setup:
1. Workers & Pages > Create > Pages > Connect to Git > this repo. No build command; build output directory `/` (leave blank).
2. Workers & Pages > KV > Create a namespace (for example `siteopsync-registry`).
3. The Pages project > Settings > Bindings (Functions) > Add > KV namespace: variable name `REGISTRY`, the namespace from step 2. Set it for Production.
4. Settings > Variables and Secrets > add a secret `SUPER_PASSWORD` (a long password). Re-deploy after adding the binding and secret.
5. Optional extra protection: Cloudflare Access (Zero Trust, free plan) in front of the page, but NOT in front of `/api/features`: each client's Apps Script calls that address without a login (it has its own key). Add a Bypass policy for the path `/api/features*`, otherwise the clients' switches stop working. Until that is set up, a long password on its own is fine.

Each client's Apps Script reads `GET /api/features?client=<id>` with the header `X-Client-Key`; the superadmin page shows the three Script Properties to paste into each client's Apps Script.
