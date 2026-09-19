<?php

declare(strict_types=1);

function cms_config(): array
{
    $values = [];
    $envFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env.local';

    if (is_readable($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $values[trim($parts[0])] = trim($parts[1], " \t\r\n\"'");
        }
    }

    $config = [
        'apiUrl' => getenv('CMS_API_URL') ?: ($values['CMS_API_URL'] ?? ''),
        'apiKey' => getenv('CMS_TENANT_API_KEY') ?: ($values['CMS_TENANT_API_KEY'] ?? ''),
        'websiteId' => getenv('CMS_WEBSITE_ID') ?: ($values['CMS_WEBSITE_ID'] ?? ''),
    ];

    if ($config['apiUrl'] === '' || $config['apiKey'] === '' || $config['websiteId'] === '') {
        throw new RuntimeException('CMS server configuration is incomplete.');
    }

    return $config;
}

function cms_request(string $path, array $query = []): array
{
    $config = cms_config();
    $query['websiteId'] = $config['websiteId'];
    $url = rtrim($config['apiUrl'], '/') . $path . '?' . http_build_query($query);

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Authorization: Bearer ' . $config['apiKey'],
        ],
    ]);

    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($body === false || $error !== '') {
        throw new RuntimeException('CMS request failed.');
    }

    $payload = json_decode($body, true);
    if (!is_array($payload)) {
        throw new RuntimeException('CMS returned an invalid response.');
    }

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('CMS returned HTTP ' . $status . '.');
    }

    return $payload;
}

function cms_json_response(array $payload, int $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function cms_error_response(Throwable $error)
{
    error_log('CMS proxy error: ' . $error->getMessage());
    cms_json_response(['success' => false, 'error' => 'Unable to load blog data.'], 502);
}
