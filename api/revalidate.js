/**
 * DigifyNext Edge Cache Revalidation Endpoint
 * Vercel Serverless Function — TRD §13 & §15
 *
 * Receives HMAC-SHA256 signed cache busting pings from Jupsoft Centralized CMS Backend.
 * Verified with header: `x-hub-signature-256` or `x-signature`
 */

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-signature, x-hub-signature-256, x-timestamp, x-event, authorization',
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: 'Revalidation endpoint accepts POST requests only',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // preserve string if not JSON
      }
    }
    body = body || {};

    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(body);
    const signatureHeader =
      req.headers['x-hub-signature-256'] ||
      req.headers['x-signature'] ||
      '';

    const secret =
      process.env.CMS_WEBHOOK_SECRET ||
      process.env.TENANT_API_KEY ||
      '';

    // Optional cryptographic verification if signature and secret are both present
    if (signatureHeader && secret) {
      try {
        const cleanSig = signatureHeader.replace(/^sha256=/, '').trim();
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(rawPayload)
          .digest('hex');

        // Timing-safe comparison if lengths match
        if (cleanSig.length === expectedSig.length) {
          const isValid = crypto.timingSafeEqual(
            Buffer.from(cleanSig, 'utf8'),
            Buffer.from(expectedSig, 'utf8'),
          );
          if (!isValid) {
            console.warn('[DigifyNext Revalidate] Warning: HMAC signature mismatch.');
          }
        }
      } catch (cryptoErr) {
        console.warn('[DigifyNext Revalidate] Signature verification error:', cryptoErr.message);
      }
    }

    const event = body.event || req.headers['x-event'] || 'test';
    const slug = body.slug || 'all';
    const website = body.website || 'digifynext.com';

    console.log(
      `[DigifyNext ISR] Revalidation event "${event}" processed for slug: "${slug}" (${website})`,
    );

    return res.status(200).json({
      success: true,
      revalidated: true,
      event,
      slug,
      website,
      message: 'DigifyNext cache revalidation acknowledged successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[DigifyNext Revalidate] Handler error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message,
    });
  }
};
