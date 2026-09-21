# DigifyNext Website & Blog

Dynamic high-performance digital marketing agency website integrated with the Jupsoft Centralized Multi-Site CMS Platform.

## Features
- **Centralized Headless CMS**: Real-time blog publishing, categories, tags, author attribution, and SEO metadata.
- **Dynamic Routing**: Automatic single-file blog detail handling (`/blog/:slug` -> `/blogdetail.html`).
- **Clean URLs**: Extensionless routing enabled on Vercel (`/about`, `/services`, `/pricing`, `/contact`).
- **Edge Reverse Proxy**: `/api/*` rewrites directly to the centralized CMS backend API.
- **301 SEO Reducer**: Automated 301 redirection pipeline honoring slug changes and canonical indexation.

---

## Vercel Deployment Setup

### 1. Root Directory & Framework Preset
- **Framework Preset**: `Other`
- **Root Directory**: `./` (or leave default)
- **Build Command**: `npm run build` (runs `node build-static.js`)
- **Output Directory**: `.` (or leave default)

### 2. Environment Variables (Vercel Dashboard)
Go to **Project Settings** -> **Environment Variables** and add your private configuration keys:

| Key | Description |
|---|---|
| `CMS_API_URL` | Centralized CMS Backend API URL |
| `NEXT_PUBLIC_CMS_API_URL` | Client-side CMS Backend URL |
| `CMS_WEBSITE_ID` | Website identifier registered in CMS |
| `NEXT_PUBLIC_CMS_WEBSITE_ID` | Client-side website identifier |
| `CMS_TENANT_API_KEY` | Tenant live secret API key (provided privately) |
| `CMS_API_KEY` | API Key alias |
| `SITE_DOMAIN` | Canonical domain for the website |
| `NEXT_PUBLIC_SITE_DOMAIN` | Public domain for OpenGraph / JSON-LD |
| `DEFAULT_LANGUAGE` | Default language code (e.g. `en`) |

---

## Local Development
To test locally, serve the directory using any static web server:
```bash
npx serve .
```
Or run the static build step:
```bash
npm run build
```
To run unit tests for client routing & sanitization pipeline:
```bash
node test-client-pipeline.js
```
