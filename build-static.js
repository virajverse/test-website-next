const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const includesDir = path.join(rootDir, 'includes');

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

// 1. Compile all .shtml files
console.log('🚀 Compiling DigifyNext SHTML into Dynamic HTML for Netlify...');
const files = fs.readdirSync(rootDir);
let count = 0;

for (const file of files) {
  if (file.endsWith('.shtml') && !fs.statSync(path.join(rootDir, file)).isDirectory()) {
    compileFile(path.join(rootDir, file));
    count++;
  }
}

// 2. Create Netlify _redirects file for 100% dynamic routing
const redirectsContent = `# Netlify Redirects Configuration for DigifyNext
# Dynamic Single-File Blog Routing (All blogs dynamically served by blogdetail.html)
/blog/:slug    /blogdetail.html    200
/blog          /blog.html          200
/blogdetail    /blogdetail.html    200

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
  from = "/*"
  to = "/:splat.html"
  status = 200
`;

fs.writeFileSync(path.join(rootDir, 'netlify.toml'), netlifyToml, 'utf8');
console.log('✅ Generated: netlify.toml');

console.log(`\n🎉 Successfully prepared ${count} dynamic pages! Netlify will route any CMS blog automatically.`);
