# DigifyNext — SSI Includes Deployment

## Kya badla
- Header, footer, popup, CSS links, scripts ab **5 include files** mein hain (`/includes/`)
- Ek baar header badla → **poori site** badal jaayegi
- Saari pages `.html` → `.shtml` (SSI ke liye zaroori — `.html` pe SSI nahi chalta)
- **URLs same rahengi**: `/blog`, `/about`, `/seo-services-company-delhi`
- Mega-menu ab **saari pages** pe (pehle sirf index pe tha)
- Popup ab **saari pages** pe (pehle sirf 8 pages pe tha)

---

## Deploy order (isi order mein)

### 1. BACKUP le (sabse pehle)
- Poora site folder copy kar ke rakh (kahin aur)
- `web.config` alag se bhi copy kar
- **Yeh skip mat karna** — kuch toota toh 1 minute mein wapas

### 2. Files upload kar
- `/includes/` folder → site root mein
- Saari 15 `.shtml` files → site root mein
- `web.config` → site root (purani replace kar de)
- **Purani `.html` files abhi delete MAT kar** — step 5 tak rehne de

### 3. App pool recycle
IIS Manager → Application Pools → digifynext ka pool → **Recycle**
(`iisreset` mat kar — server pe aur sites bhi hain)

### 4. Cloudflare purge — EK BAAR
Cloudflare → Caching → Configuration → **Purge Everything**
(Yeh zaroori hai warna purana cached version dikhega)

### 5. Test kar (5 minute)
- [ ] `digifynext.com` → homepage khule
- [ ] `digifynext.com/about` → khule, header/footer dikhe
- [ ] `digifynext.com/blog` → khule
- [ ] Desktop: Services pe hover → white mega-menu khule, tabs chalein
- [ ] Mobile: hamburger → sidebar slide ho
- [ ] Koi bhi "Get Free Audit" → popup khule
- [ ] `digifynext.com/blog.html` → `/blog` pe redirect ho (301)

### 6. Sab theek toh purani files delete
- Saari `.html` files delete kar (`.shtml` versions ab live hain)
- `ssitest.html` aur `ssitest.shtml` bhi delete kar

---

## Agar toot jaaye
- **500 error** → `web.config` backup wapas daal. Matlab `ServerSideIncludeModule` ka naam alag hai is server pe.
- **Header/footer gayab, include comment dikhe** → SSI process nahi hua. Handler check kar.
- **Purana version dikhe** → Cloudflare purge dobara kar

---

## Aage se
- **Header/footer badalna ho** → sirf `/includes/` ki file edit kar → upload → Cloudflare purge. Bas.
- **Naya page banao** → `.shtml` extension, aur 5 include lines daal:
```
<!--#include virtual="/includes/head-css.shtml" -->   (head mein)
<!--#include virtual="/includes/header.shtml" -->     (body ke shuru mein)
   ... page ka content ...
<!--#include virtual="/includes/footer.shtml" -->
<!--#include virtual="/includes/popup.shtml" -->
<!--#include virtual="/includes/scripts.shtml" -->    (</body> se pehle)
```

---

---

## Dynamic CMS & Clean Blog Slugs Configuration

### 1. Naya API / Webhook change karna ho:
- **Client (Frontend)**: [js/cms-config.js](file:///D:/Company%20work/jupsoft-centralized-blog-platform/digifynext/js/cms-config.js) me `apiUrl`, `websiteId`, aur `apiKey` change karein.
- **Server / Webhook**: [.env.local](file:///D:/Company%20work/jupsoft-centralized-blog-platform/digifynext/.env.local) me `CMS_API_URL`, `CMS_WEBSITE_ID`, aur `CMS_WEBHOOK_SECRET` change karein.

### 2. URLs format:
- Blog Listing: `digifynext.com/blog`
- Single Blog Post: `digifynext.com/blog/{slug}` (e.g. `/blog/zero-trust-cloud-security-protecting-apis-and-distributed-microservices`)
- Legacy URLs: `digifynext.com/blogdetail?slug=xyz` automatically 301 permanently redirect to `/blog/xyz`.

### 3. Revalidation Webhook Endpoint:
- URL: `https://digifynext.com/api/revalidate`
- Validates signature with `CMS_WEBHOOK_SECRET` and triggers instant cache refresh.

---

## Netlify Deployment Guide

Netlify pe `.shtml` ya IIS `web.config` direct nahi chalta, isliye Netlify ke liye ready static setup kar diya hai:
1. **Direct Drag & Drop**:
   - `digifynext` folder ko seedhe Netlify Drop (`app.netlify.com/drop`) pe drag kar dein.
   - Saari `.html` files (`index.html`, `blog.html`, `blogdetail.html`, etc.) compiled hain.
2. **Git Auto-Deployment**:
   - Repository connect hone par `netlify.toml` automatically `node build-static.js` run karega.
3. **Clean Slugs & Routing**:
   - `_redirects` file Netlify par `/blog/:slug` ko automatically `blogdetail.html` par render karegi.


