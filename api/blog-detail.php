<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . '_cms.php';

$slug = isset($_GET['slug']) ? trim((string) $_GET['slug']) : '';
if ($slug === '' || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/', $slug)) {
    cms_json_response(['success' => false, 'error' => 'A valid blog slug is required.'], 400);
}

try {
    cms_json_response(cms_request('/v1/blogs/' . rawurlencode($slug)));
} catch (Throwable $error) {
    cms_error_response($error);
}
