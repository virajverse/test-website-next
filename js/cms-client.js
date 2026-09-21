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
   * Fetch paginated list of published blogs
   * Always fetches fresh data from network so new/edited articles appear on 1st load!
   * Gracefully falls back to cache if offline or network failure.
   */
  function fetchBlogs(options) {
    options = options || {};
    var limit = options.limit || 20;
    var page = options.page || 1;
    var websiteId = config.websiteId || 'site-growth';

    var cacheKey = 'cms_blogs_' + websiteId + '_p' + page + '_l' + limit + '_' + (options.category || 'all');

    // Retrieve cached data for instant paint callback or offline fallback
    var cached = memoryCache.get(cacheKey) || null;
    if (!cached && typeof sessionStorage !== 'undefined') {
      try {
        var stored = sessionStorage.getItem(cacheKey);
        if (stored) {
          var parsed = JSON.parse(stored);
          cached = parsed && parsed.data ? parsed.data : parsed;
          if (cached) memoryCache.set(cacheKey, cached);
        }
      } catch (e) {}
    }

    // Optional instant hydration callback (caller can render cached data before network completes)
    if (cached && typeof options.onCache === 'function') {
      try { options.onCache(cached); } catch (e) {}
    }

    var query = '?website=' + encodeURIComponent(websiteId) +
      '&limit=' + encodeURIComponent(limit) +
      '&page=' + encodeURIComponent(page);

    if (options.category) query += '&category=' + encodeURIComponent(options.category);
    if (options.tag) query += '&tag=' + encodeURIComponent(options.tag);
    if (config.apiKey) query += '&apiKey=' + encodeURIComponent(config.apiKey);

    var primaryUrl = getBaseApiUrl() + '/v1/blogs' + query;
    var proxyUrl = '/api/blogs' + query;

    var reqHeaders = { 'Accept': 'application/json' };
    if (config.apiKey) reqHeaders['x-api-key'] = config.apiKey;

    function doFetch(url) {
      return fetchWithTimeout(url, {
        method: 'GET',
        headers: reqHeaders,
        mode: 'cors'
      }, 4000).then(function (response) {
        if (!response.ok) throw new Error('CMS API HTTP ' + response.status);
        return response.json();
      });
    }

    return doFetch(primaryUrl)
      .catch(function (primaryErr) {
        // Fallback to /api proxy on custom deployment domains (e.g. Netlify / Vercel)
        if (typeof window !== 'undefined' && window.location.origin && getBaseApiUrl() !== window.location.origin) {
          return doFetch(proxyUrl).catch(function () {
            throw primaryErr;
          });
        }
        throw primaryErr;
      })
      .then(function (result) {
        // Update caches with fresh live data
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
      })
      .catch(function (error) {
        // Offline / network failure fallback: if network fails, return cached blogs
        if (cached) {
          console.warn('CMS network fetch failed, serving from cache:', error);
          return cached;
        }
        throw error;
      });
  }

  /**
   * Fetch single blog article by slug with SEO metadata
   * Always fetches fresh data from network so edits appear on 1st load!
   * Gracefully falls back to cache if offline or network failure.
   */
  function fetchBlogBySlug(slug, options) {
    if (!slug) {
      return Promise.reject(new Error('Slug is required'));
    }

    options = options || {};
    var websiteId = config.websiteId || 'site-growth';
    var cleanSlug = encodeURIComponent(slug);
    var cacheKey = 'cms_article_' + cleanSlug;

    // Retrieve cached article for instant paint callback or offline fallback
    var cached = memoryCache.get(cacheKey) || null;
    if (!cached && typeof sessionStorage !== 'undefined') {
      try {
        var storedArticle = sessionStorage.getItem(cacheKey);
        if (storedArticle) {
          var parsed = JSON.parse(storedArticle);
          cached = parsed && parsed.data ? parsed.data : (parsed && parsed.title ? parsed : null);
          if (cached) memoryCache.set(cacheKey, cached);
        }
      } catch (e) {}
    }

    // Optional instant hydration callback
    if (cached && typeof options.onCache === 'function') {
      try { options.onCache(cached); } catch (e) {}
    }

    var primaryUrl = getBaseApiUrl() + '/v1/blogs/' + cleanSlug + '?website=' + encodeURIComponent(websiteId) + (config.apiKey ? '&apiKey=' + encodeURIComponent(config.apiKey) : '');
    var proxyUrl = '/api/blogs/' + cleanSlug;

    var reqHeaders = { 'Accept': 'application/json' };
    if (config.apiKey) reqHeaders['x-api-key'] = config.apiKey;

    function doFetch(url) {
      return fetchWithTimeout(url, {
        method: 'GET',
        headers: reqHeaders,
        mode: 'cors'
      }, 4000).then(function (response) {
        if (!response.ok) throw new Error('CMS API HTTP ' + response.status);
        return response.json();
      });
    }

    return doFetch(primaryUrl)
      .catch(function (primaryErr) {
        // Fallback to proxy on custom deployment domains
        if (typeof window !== 'undefined' && window.location.origin && getBaseApiUrl() !== window.location.origin) {
          return doFetch(proxyUrl).catch(function () {
            throw primaryErr;
          });
        }
        throw primaryErr;
      })
      .then(function (res) {
        var data = res.data || res;
        if (res.redirect) {
          data.redirect = res.redirect;
        }
        memoryCache.set(cacheKey, data);
        if (typeof sessionStorage !== 'undefined') {
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data })); } catch (e) {}
        }
        return data;
      })
      .catch(function (error) {
        // Offline / network failure fallback: if network fails, return cached article
        if (cached) {
          console.warn('CMS network fetch failed, serving article from cache:', error);
          return cached;
        }
        throw error;
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.DigifyCMS;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
