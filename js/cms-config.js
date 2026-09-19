/**
 * Jupsoft Centralized CMS - DigifyNext Configuration
 * 
 * IMPORTANT: Security Best Practice
 * Private API Keys aur Webhook Secrets ko client-side JavaScript me expose NA karein.
 * Public blog reads ke liye websiteId kaafi hota hai.
 * Server credentials sirf .env.local me rehte hain.
 */
window.CMS_CONFIG = {
  // Centralized CMS Backend API URL (bina trailing slash ke)
  apiUrl: 'https://blogary.jupsoft.com',

  // Tenant Website Identifier (Database me registered website id ya slug)
  websiteId: 'site-growth',

  // Site Base Domain
  siteDomain: 'https://digifynext.com',

  // Default Language
  defaultLanguage: 'en',

  // Default Fallback Image
  defaultFeaturedImage: '/images/blog1.jpg',
};
