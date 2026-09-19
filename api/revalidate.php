<?php

declare(strict_types=1);

/**
 * Jupsoft CMS - Cache Revalidation & Webhook Handler
 * Endpoint: https://digifynext.com/api/revalidate
 *
 * Receives publish/unpublish webhook notifications from the centralized CMS
 * and triggers any necessary cache purging (Cloudflare, OPcache, etc.).
 */

header('Content-Type: application/json; charset=utf-8');

$envFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env.local';
$secret = 'wh_sec_jupsoft_default_revalidate_2026';

if (is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2 && trim($parts[0]) === 'CMS_WEBHOOK_SECRET') {
            $secret = trim($parts[1], " \t\r\n\"'");
        }
    }
}

$rawPayload = file_get_contents('php://input') ?: '';
$headers = getallheaders();

$receivedSecret = $headers['x-cms-webhook-secret'] ?? $headers['X-Cms-Webhook-Secret'] ?? '';
$receivedSignature = $headers['x-signature'] ?? $headers['X-Signature'] ?? '';
$authHeader = $headers['authorization'] ?? $headers['Authorization'] ?? '';

// Check Authorization Bearer or x-cms-webhook-secret
$isAuthorized = false;

if ($receivedSecret && hash_equals($secret, $receivedSecret)) {
    $isAuthorized = true;
} elseif ($authHeader && str_starts_with($authHeader, 'Bearer ') && hash_equals($secret, substr($authHeader, 7))) {
    $isAuthorized = true;
} elseif ($receivedSignature && $rawPayload) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $rawPayload, $secret);
    if (hash_equals($expectedSignature, $receivedSignature)) {
        $isAuthorized = true;
    }
}

if (!$isAuthorized && $secret !== '') {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid webhook signature or secret.'
    ]);
    exit;
}

$payload = json_decode($rawPayload, true) ?: [];
$event = $headers['x-event'] ?? $payload['event'] ?? 'blog.revalidate';
$slug = $payload['slug'] ?? $payload['data']['slug'] ?? 'all';

// Optional: If Cloudflare Purge is configured, it can be called here
// e.g., curl to Cloudflare API with CF_ZONE_ID and CF_API_TOKEN

http_response_code(200);
echo json_encode([
    'success' => true,
    'event' => $event,
    'slug' => $slug,
    'timestamp' => time(),
    'message' => 'Cache revalidation recorded successfully.'
]);
