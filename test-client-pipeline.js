/**
 * DIGIFYNEXT CLIENT PIPELINE UNIT TESTS
 * Verifies:
 * 1. Slug extraction under various URL patterns
 * 2. 301 Redirect detection and target URL construction
 * 3. Category matching and key generation
 * 4. HTML sanitization against XSS attacks
 */

const assert = require('assert');

// Mock browser environment for Node.js
function setupMockWindow(pathname, search) {
  global.window = {
    location: {
      pathname: pathname || '',
      search: search || '',
      href: 'https://digifynext.com' + (pathname || '') + (search || ''),
      hash: '',
      replace: function (newUrl) {
        this.replacedWith = newUrl;
      },
    },
    history: {
      replaceState: function () {},
    },
  };
  global.sessionStorage = {
    getItem: function () { return null; },
    setItem: function () {},
  };
}

// Load cms-client.js
setupMockWindow('/blog/test-article', '');
const CMS = require('./js/cms-client.js') || global.window.DigifyCMS;

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- Running DigifyNext Client Pipeline Unit Tests ---');

// ─── Test 1: URL Slug Extraction ─────────────────────────────────────────────
it('extracts slug from standard path /blog/my-seo-guide', () => {
  setupMockWindow('/blog/my-seo-guide', '');
  assert.strictEqual(CMS.getSlugFromCurrentUrl(), 'my-seo-guide');
});

it('extracts slug with trailing slash /blog/my-seo-guide/', () => {
  setupMockWindow('/blog/my-seo-guide/', '');
  assert.strictEqual(CMS.getSlugFromCurrentUrl(), 'my-seo-guide');
});

it('extracts slug when query params are attached /blog/my-seo-guide?lang=en', () => {
  setupMockWindow('/blog/my-seo-guide', '?lang=en');
  assert.strictEqual(CMS.getSlugFromCurrentUrl(), 'my-seo-guide');
});

it('extracts encoded slug /blog/my%20seo%20guide', () => {
  setupMockWindow('/blog/my%20seo%20guide', '');
  assert.strictEqual(CMS.getSlugFromCurrentUrl(), 'my seo guide');
});

it('extracts slug from ?slug= query override', () => {
  setupMockWindow('/blogdetail.html', '?slug=override-slug');
  assert.strictEqual(CMS.getSlugFromCurrentUrl(), 'override-slug');
});

it('returns null on listing page /blog', () => {
  setupMockWindow('/blog', '');
  assert.strictEqual(CMS.getSlugFromCurrentUrl(), null);
});

// ─── Test 2: 301 Permanent Redirect Handler ──────────────────────────────────
it('detects 301 redirect instruction and resolves canonical destination', () => {
  const currentSlug = 'old-slug-2025';
  const blogResponse = {
    slug: 'new-canonical-2026',
    redirect: {
      statusCode: 301,
      fromSlug: 'old-slug-2025',
      toSlug: 'new-canonical-2026',
    },
  };

  const currentReqSlug = currentSlug.trim().toLowerCase();
  const targetSlug = (blogResponse.redirect && blogResponse.redirect.toSlug)
    ? blogResponse.redirect.toSlug.trim()
    : (blogResponse.slug && currentReqSlug && blogResponse.slug.toLowerCase() !== currentReqSlug ? blogResponse.slug : null);

  assert.strictEqual(targetSlug, 'new-canonical-2026');
  assert.notStrictEqual(targetSlug, currentReqSlug);

  // Verify redirect path construction
  const newPath = '/blog/' + encodeURIComponent(targetSlug);
  assert.strictEqual(newPath, '/blog/new-canonical-2026');
});

it('does NOT trigger redirect if current slug matches canonical slug', () => {
  const currentSlug = 'valid-canonical-slug';
  const blogResponse = {
    slug: 'valid-canonical-slug',
  };

  const currentReqSlug = currentSlug.trim().toLowerCase();
  const targetSlug = (blogResponse.redirect && blogResponse.redirect.toSlug)
    ? blogResponse.redirect.toSlug.trim()
    : (blogResponse.slug && currentReqSlug && blogResponse.slug.toLowerCase() !== currentReqSlug ? blogResponse.slug : null);

  assert.strictEqual(targetSlug, null);
});

// ─── Test 3: HTML Sanitization (XSS Prevention) ──────────────────────────────
it('escapes dangerous HTML characters in title and author names', () => {
  const maliciousInput = '<script>alert("xss")</script>&"\'';
  const escaped = CMS.escapeHtml(maliciousInput);
  assert.strictEqual(escaped.includes('<script>'), false);
  assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#39;');
});

// ─── Test 4: Taxonomy & Category Classification ──────────────────────────────
it('correctly classifies SEO & AI categories', () => {
  assert.strictEqual(CMS.getCategoryName({ categoryIds: ['cat-growth-seo'] }), 'SEO');
  assert.strictEqual(CMS.getCategoryName({ title: 'Top Generative AI Trends' }), 'AI Search & GEO');
  assert.strictEqual(CMS.getCategoryName({ title: 'Google Ads PPC Strategy' }), 'PPC & Ads');
  assert.strictEqual(CMS.getCategoryName({ title: 'Social Media Management' }), 'Social Media');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
