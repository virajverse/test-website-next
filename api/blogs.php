<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . '_cms.php';

try {
    cms_json_response(cms_request('/v1/blogs', ['limit' => 100]));
} catch (Throwable $error) {
    cms_error_response($error);
}
