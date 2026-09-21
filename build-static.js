const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const sourceDir = fs.existsSync(path.join(rootDir, '_source_files')) ? path.join(rootDir, '_source_files') : rootDir;
const includesDir = path.join(sourceDir, 'includes');

// Cache includes content
const includeCache = {};

function getIncludeContent(virtualPath) {
  const filename = path.basename(virtualPath);
  if (!includeCache[filename]) {
    const fullPath = path.join(includesDir, filename);
    if (fs.existsSync(fullPath)) {
      includeCache[filename] = fs.readFileSync(fullPath, 'utf8');
    } else {
      console.warn(`⚠️ Include file not found: ${fullPath}`);
      includeCache[filename] = '';
    }
  }
  return includeCache[filename];
}

function compileFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace SSI <!--#include virtual="..." -->
  const compiled = content.replace(/<!--#include\s+virtual="([^"]+)"\s*-->/gi, (match, vPath) => {
    return getIncludeContent(vPath);
  });

  const baseName = path.basename(filePath, '.shtml');
  const targetHtml = path.join(rootDir, `${baseName}.html`);
  fs.writeFileSync(targetHtml, compiled, 'utf8');
  console.log(`✅ Generated: ${baseName}.html`);
}

// 1. Compile all .shtml files (if source files exist)
let count = 0;
if (fs.existsSync(sourceDir)) {
  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    if (file.endsWith('.shtml') && !fs.statSync(path.join(sourceDir, file)).isDirectory()) {
      compileFile(path.join(sourceDir, file));
      count++;
    }
  }
}
if (count > 0) {
  console.log(`✅ Compiled ${count} .shtml files into .html`);
} else {
  console.log('✅ All production .html pages are already up-to-date.');
}

// 2. Read Environment Variables (for Vercel, Netlify, or Local build)
const apiUrl = (process.env.CMS_API_URL || process.env.NEXT_PUBLIC_CMS_API_URL || 'https://blogary.jupsoft.com').replace(/\/+$/, '');
const websiteId = process.env.CMS_WEBSITE_ID || process.env.NEXT_PUBLIC_CMS_WEBSITE_ID || 'site-growth';
const apiKey = process.env.CMS_TENANT_API_KEY || process.env.CMS_API_KEY || process.env.NEXT_PUBLIC_CMS_API_KEY || '';
const siteDomain = (process.env.SITE_DOMAIN || process.env.NEXT_PUBLIC_SITE_DOMAIN || 'https://digifynext.com').replace(/\/+$/, '');
const defaultLanguage = process.env.DEFAULT_LANGUAGE || 'en';

// 3. Generate/Update js/cms-config.js
const cmsConfigContent = `/**
 * Jupsoft Centralized CMS - DigifyNext Configuration
 * Generated dynamically at build time or using defaults.
 */
(function () {
  var isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  var queryApi = '';
  if (typeof window !== 'undefined' && window.location.search) {
    try {
      var params = new URLSearchParams(window.location.search);
      queryApi = params.get('api') || params.get('cms_api') || '';
    } catch (e) {}
  }

  var apiUrl = '${apiUrl}';
  if (queryApi === 'local') {
    apiUrl = 'http://localhost:4000';
  } else if (queryApi && queryApi !== 'production') {
    apiUrl = queryApi.replace(/\\/+$/, '');
  }

  window.CMS_CONFIG = {
    apiUrl: apiUrl,
    websiteId: '${websiteId}',
    apiKey: '${apiKey}',
    siteDomain: '${siteDomain}',
    defaultLanguage: '${defaultLanguage}',
    defaultFeaturedImage: '/images/blog1.jpg',
  };
})();
`;
const jsDir = path.join(rootDir, 'js');
if (fs.existsSync(jsDir)) {
  fs.writeFileSync(path.join(jsDir, 'cms-config.js'), cmsConfigContent, 'utf8');
  console.log('✅ Generated: js/cms-config.js');
}

// 4. Create Vercel vercel.json configuration
const vercelConfig = {
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": `${apiUrl}/v1/:path*`
    },
    {
      "source": "/blog/:slug",
      "destination": "/blogdetail.html"
    },
    {
      "source": "/blog",
      "destination": "/blog.html"
    },
    {
      "source": "/blogdetail",
      "destination": "/blogdetail.html"
    }
  ],
  "redirects": [
    {
      "source": "/blog.shtml",
      "destination": "/blog",
      "permanent": true
    },
    {
      "source": "/about.shtml",
      "destination": "/about",
      "permanent": true
    }
  ]
};
fs.writeFileSync(path.join(rootDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2), 'utf8');
console.log('✅ Generated: vercel.json');

// 5. Create Netlify _redirects file for 100% dynamic routing
const redirectsContent = `# Netlify Redirects Configuration for DigifyNext
# Dynamic Single-File Blog Routing (All blogs dynamically served by blogdetail.html)
/blog/:slug    /blogdetail.html    200
/blog          /blog.html          200
/blogdetail    /blogdetail.html    200

# Block direct access to internal source directory
/_source_files/*   /               404

# Reverse proxy /api calls directly to centralized backend
/api/*         ${apiUrl}/v1/:splat   200

# Legacy .shtml direct requests -> clean URLs
/blog.shtml    /blog               301
/about.shtml   /about              301

# Extensionless Pretty URLs for all static pages
/*             /:splat.html        200
`;

fs.writeFileSync(path.join(rootDir, '_redirects'), redirectsContent, 'utf8');
console.log('✅ Generated: _redirects');

// 6. Create netlify.toml
const netlifyToml = `[build]
  publish = "."
  command = "node build-static.js"

[[redirects]]
  from = "/api/*"
  to = "${apiUrl}/v1/:splat"
  status = 200

[[redirects]]
  from = "/blog/:slug"
  to = "/blogdetail.html"
  status = 200

[[redirects]]
  from = "/blog"
  to = "/blog.html"
  status = 200

[[redirects]]
  from = "/blogdetail"
  to = "/blogdetail.html"
  status = 200

[[redirects]]
  from = "/_source_files/*"
  to = "/"
  status = 404

[[redirects]]
  from = "/*"
  to = "/:splat.html"
  status = 200
`;

fs.writeFileSync(path.join(rootDir, 'netlify.toml'), netlifyToml, 'utf8');
console.log('✅ Generated: netlify.toml');

console.log(`\n🎉 Successfully prepared ${count} dynamic pages! Vercel & Netlify configured.`);

