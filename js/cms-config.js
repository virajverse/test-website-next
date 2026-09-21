/**
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

  var apiUrl = 'https://blogary.jupsoft.com';
  if (queryApi === 'local') {
    apiUrl = 'http://localhost:4000';
  } else if (queryApi && queryApi !== 'production') {
    apiUrl = queryApi.replace(/\/+$/, '');
  }

  window.CMS_CONFIG = {
    apiUrl: apiUrl,
    websiteId: 'site-growth',
    apiKey: '',
    siteDomain: 'https://digifynext.com',
    defaultLanguage: 'en',
    defaultFeaturedImage: '/images/blog1.jpg',
  };
})();
