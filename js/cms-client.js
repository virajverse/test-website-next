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
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    var cached = memoryCache.get(cacheKey);
    if (!cached && typeof sessionStorage !== 'undefined') {
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

    // Check instant cache
    if (memoryCache.has(cacheKey)) {
      return Promise.resolve(memoryCache.get(cacheKey));
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
    return 'Digital Marketing';
  }

  function getCategoryKey(category) {
    var value = String(category || '').toLowerCase();
    if (value.includes('seo')) return 'seo';
    if (value.includes('geo') || value.includes('ai')) return 'geo';
    if (value.includes('ppc') || value.includes('ads')) return 'ppc';
    if (value.includes('social')) return 'social';
    if (value.includes('brand')) return 'branding';
    if (value.includes('web')) return 'web';
    if (value.includes('orm') || value.includes('reputation')) return 'orm';
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
