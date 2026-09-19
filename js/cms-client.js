/**
 * Jupsoft Centralized CMS - DigifyNext Frontend Client
 * High-Performance, Zero-Delay Engine:
 * - 3000ms AbortController fast-timeout (never hangs on inactive domains)
 * - In-memory & SessionStorage Stale-While-Revalidate caching (0ms instant render)
 * - Zero API Key Exposure: Public consumer reads use tenant scope
 */
(function (global) {
  'use strict';

  var config = global.CMS_CONFIG || {
    apiUrl: 'https://blogary.jupsoft.com',
    websiteId: 'site-growth',
    siteDomain: 'https://digifynext.com',
    defaultFeaturedImage: 'images/blog1.jpg'
  };

  var memoryCache = new Map();
  var CACHE_TTL_MS = 10 * 1000; // 10 seconds (instant visibility on publish)

  function getBaseApiUrl() {
    return (config.apiUrl || 'https://blogary.jupsoft.com').replace(/\/+$/, '');
  }

  /**
   * Safe fetch with AbortController timeout
   */
  function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 3000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var signal = controller ? controller.signal : undefined;
    var timer = null;

    var fetchPromise = fetch(url, Object.assign({}, options || {}, { signal: signal }));

    var timeoutPromise = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error('CMS request timed out after ' + timeoutMs + 'ms'));
      }, timeoutMs);
    });

    return Promise.race([fetchPromise, timeoutPromise]).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  /**
   * Intelligently extract blog slug from URL
   */
  function getSlugFromCurrentUrl() {
    var searchParams = new URLSearchParams(window.location.search);
    var querySlug = searchParams.get('slug');
    if (querySlug && querySlug.trim() !== '') {
      return querySlug.trim();
    }

    var pathname = window.location.pathname.replace(/\/+$/, '');
    var blogIndex = pathname.indexOf('/blog/');
    if (blogIndex !== -1) {
      var slug = pathname.substring(blogIndex + 6).split('/')[0].split('?')[0];
      if (slug && slug !== 'blog' && slug !== 'blog.shtml') {
        return decodeURIComponent(slug);
      }
    }

    return null;
  }

  /**
   * Fetch paginated list of published blogs with 0-delay cache
   */
  function fetchBlogs(options) {
    options = options || {};
    var limit = options.limit || 20;
    var page = options.page || 1;
    var websiteId = config.websiteId || 'site-growth';

    var cacheKey = 'cms_blogs_' + websiteId + '_p' + page + '_l' + limit + '_' + (options.category || 'all');

    // 1. Instant cache check (0ms delay)
    var cached = options.bypassCache ? null : memoryCache.get(cacheKey);
    if (!cached && !options.bypassCache && typeof sessionStorage !== 'undefined') {
      try {
        var stored = sessionStorage.getItem(cacheKey);
        if (stored) {
          var parsed = JSON.parse(stored);
          if (parsed && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
            cached = parsed.data;
            memoryCache.set(cacheKey, cached);
          }
        }
      } catch (e) {}
    }

    var query = '?website=' + encodeURIComponent(websiteId) +
      '&limit=' + encodeURIComponent(limit) +
      '&page=' + encodeURIComponent(page);

    if (options.category) query += '&category=' + encodeURIComponent(options.category);
    if (options.tag) query += '&tag=' + encodeURIComponent(options.tag);

    var primaryUrl = getBaseApiUrl() + '/v1/blogs' + query;
    var proxyUrl = '/api/blogs' + query;

    var networkPromise = fetchWithTimeout(primaryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors'
    }, 3000)
      .then(function (response) {
        if (!response.ok) throw new Error('CMS API HTTP ' + response.status);
        return response.json();
      })
      .catch(function (error) {
        // Silent fast fallback to local PHP proxy if remote domain is inactive
        return fetchWithTimeout(proxyUrl, {}, 2500)
          .then(function (res) {
            if (!res.ok) throw new Error('CMS Proxy HTTP ' + res.status);
            return res.json();
          });
      })
      .then(function (result) {
        // Save to cache
        memoryCache.set(cacheKey, result);
        if (typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result }));
            // Cross-page instant preload: seed each article summary
            var list = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
            list.forEach(function (b) {
              if (b && b.slug) {
                sessionStorage.setItem('cms_summary_' + encodeURIComponent(b.slug), JSON.stringify(b));
              }
            });
          } catch (e) {}
        }
        return result;
      });

    // If cache exists, return cached immediately (0 delay)
    if (cached) {
      // Revalidate in background without blocking render
      networkPromise.catch(function () {});
      return Promise.resolve(cached);
    }

    return networkPromise;
  }

  /**
   * Fetch single blog article by slug with SEO metadata and caching
   */
  function fetchBlogBySlug(slug) {
    if (!slug) {
      return Promise.reject(new Error('Slug is required'));
    }

    var websiteId = config.websiteId || 'site-growth';
    var cleanSlug = encodeURIComponent(slug);
    var cacheKey = 'cms_article_' + cleanSlug;

    // Check instant in-memory cache
    if (memoryCache.has(cacheKey)) {
      return Promise.resolve(memoryCache.get(cacheKey));
    }

    // Check instant session cache (0 delay on back/forward or repeat visits)
    if (typeof sessionStorage !== 'undefined') {
      try {
        var storedArticle = sessionStorage.getItem(cacheKey);
        if (storedArticle) {
          var parsedArticle = JSON.parse(storedArticle);
          if (parsedArticle && parsedArticle.title) {
            memoryCache.set(cacheKey, parsedArticle);
            return Promise.resolve(parsedArticle);
          }
        }
      } catch (e) {}
    }

    var primaryUrl = getBaseApiUrl() + '/v1/blogs/' + cleanSlug + '?website=' + encodeURIComponent(websiteId);
    var proxyUrl = '/api/blogs/' + cleanSlug;

    return fetchWithTimeout(primaryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors'
    }, 3000)
      .then(function (response) {
        if (!response.ok) throw new Error('CMS API HTTP ' + response.status);
        return response.json();
      })
      .then(function (res) {
        var data = res.data || res;
        memoryCache.set(cacheKey, data);
        if (typeof sessionStorage !== 'undefined') {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        }
        return data;
      })
      .catch(function (error) {
        return fetchWithTimeout(proxyUrl, {}, 2500)
          .then(function (res) {
            if (!res.ok) throw new Error('CMS Proxy HTTP ' + res.status);
            return res.json();
          })
          .then(function (res) {
            var data = res.data || res;
            memoryCache.set(cacheKey, data);
            if (typeof sessionStorage !== 'undefined') {
              try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
            }
            return data;
          });
      });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[char];
    });
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    var options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  function getCategoryName(blog) {
    if (blog.categoryName) return blog.categoryName;
    if (blog.category) return blog.category;
    if (blog.primaryCategory) return blog.primaryCategory;
    if (Array.isArray(blog.categories) && blog.categories.length > 0) {
      return blog.categories[0].name || blog.categories[0];
    }
    // Match by categoryIds (e.g. cat-growth-seo)
    if (Array.isArray(blog.categoryIds) && blog.categoryIds.length > 0) {
      var cid = String(blog.categoryIds[0]).toLowerCase();
      if (cid.indexOf('seo') !== -1) return 'SEO';
      if (cid.indexOf('ai') !== -1 || cid.indexOf('geo') !== -1) return 'AI Search & GEO';
      if (cid.indexOf('content') !== -1) return 'Content Strategy';
      if (cid.indexOf('cro') !== -1) return 'Conversion Optimization';
      if (cid.indexOf('ppc') !== -1 || cid.indexOf('ads') !== -1) return 'PPC & Ads';
      if (cid.indexOf('social') !== -1 || cid.indexOf('smo') !== -1) return 'Social Media';
    }
    // Match by keywords in title / slug
    var text = ((blog.title || '') + ' ' + (blog.slug || '')).toLowerCase();
    if (text.indexOf('seo') !== -1 || text.indexOf('search') !== -1) return 'SEO';
    if (text.indexOf('ai') !== -1 || text.indexOf('agent') !== -1 || text.indexOf('mcp') !== -1 || text.indexOf('geo') !== -1) return 'AI Search & GEO';
    if (text.indexOf('ppc') !== -1 || text.indexOf('ads') !== -1 || text.indexOf('google ads') !== -1) return 'PPC & Ads';
    if (text.indexOf('social') !== -1 || text.indexOf('media') !== -1) return 'Social Media';
    if (text.indexOf('brand') !== -1 || text.indexOf('creative') !== -1) return 'Branding';
    if (text.indexOf('web') !== -1 || text.indexOf('dev') !== -1 || text.indexOf('api') !== -1) return 'Web Dev';
    return 'Digital Marketing';
  }

  function getCategoryKey(category) {
    var value = String(category || '').toLowerCase();
    if (value.indexOf('seo') !== -1) return 'seo';
    if (value.indexOf('geo') !== -1 || value.indexOf('ai') !== -1) return 'geo';
    if (value.indexOf('ppc') !== -1 || value.indexOf('ad') !== -1) return 'ppc';
    if (value.indexOf('social') !== -1) return 'social';
    if (value.indexOf('brand') !== -1) return 'branding';
    if (value.indexOf('web') !== -1 || value.indexOf('content') !== -1) return 'web';
    if (value.indexOf('orm') !== -1 || value.indexOf('reputation') !== -1) return 'orm';
    return 'all';
  }

  // Export to global scope
  global.DigifyCMS = {
    config: config,
    getSlugFromCurrentUrl: getSlugFromCurrentUrl,
    fetchBlogs: fetchBlogs,
    fetchBlogBySlug: fetchBlogBySlug,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    getCategoryName: getCategoryName,
    getCategoryKey: getCategoryKey
  };
})(window);
