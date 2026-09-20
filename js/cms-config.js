/**
 * Jupsoft Centralized CMS - DigifyNext Configuration
 * 
 * IMPORTANT: Security Best Practice
 * Private API Keys aur Webhook Secrets ko client-side JavaScript me expose NA karein.
 * Public blog reads ke liye websiteId kaafi hota hai.
 * Server credentials sirf .env.local me rehte hain.
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
    // Centralized CMS Backend API URL (bina trailing slash ke)
    apiUrl: apiUrl,

    // Tenant Website Identifier (Database me registered website id ya slug)
    websiteId: 'site-growth',

    // Site Base Domain
    siteDomain: 'https://digifynext.com',

    // Default Language
    defaultLanguage: 'en',

    // Default Fallback Image
    defaultFeaturedImage: '/images/blog1.jpg',
  };
})();
