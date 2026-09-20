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

// 2. Create Netlify _redirects file for 100% dynamic routing
const redirectsContent = `# Netlify Redirects Configuration for DigifyNext
# Dynamic Single-File Blog Routing (All blogs dynamically served by blogdetail.html)
/blog/:slug    /blogdetail.html    200
/blog          /blog.html          200
/blogdetail    /blogdetail.html    200

# Block direct access to internal source directory
/_source_files/*   /               404

# Reverse proxy /api calls directly to centralized backend
/api/*         https://blogary.jupsoft.com/v1/:splat   200

# Legacy .shtml direct requests -> clean URLs
/blog.shtml    /blog               301
/about.shtml   /about              301

# Extensionless Pretty URLs for all static pages
/*             /:splat.html        200
`;

fs.writeFileSync(path.join(rootDir, '_redirects'), redirectsContent, 'utf8');
console.log('✅ Generated: _redirects');

// 3. Create netlify.toml
const netlifyToml = `[build]
  publish = "."
  command = "node build-static.js"

[[redirects]]
  from = "/api/*"
  to = "https://blogary.jupsoft.com/v1/:splat"
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

console.log(`\n🎉 Successfully prepared ${count} dynamic pages! Netlify will route any CMS blog automatically.`);
