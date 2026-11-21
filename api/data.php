<?php
/**
 * iBCB-HUB data endpoint.
 *
 * GET /ibcb-hub/api/data.php?set=lenders|cards
 * Returns the published rows of the Google Sheet as JSON: only rows with
 * "Show on site" = Yes and a status other than Closed, and only the columns
 * the site displays.
 *
 * Order of sources: fresh cache, Google Sheet, stale cache, saved copy in
 * /ibcb-hub/data/. The page therefore keeps working if Google is unreachable.
 *
 * CLI (used to refresh the saved copy): php data.php lenders path/to/file.csv
 */

declare(strict_types=1);

const COLUMNS = [
    'lenders' => [
        'ID' => ['id', 'text'],
        'Name' => ['name', 'text'],
        'Status' => ['status', 'text'],
        'Show on site' => ['show', 'text'],
        'Type' => ['type', 'text'],
        'Products' => ['products', 'text'],
        'Min amount ($)' => ['minAmount', 'number'],
        'Max amount ($)' => ['maxAmount', 'number'],
        'Min credit score' => ['minCredit', 'number'],
        'Min time in business (months)' => ['minMonths', 'number'],
        'Min monthly revenue ($)' => ['minRevenue', 'number'],
        'Availability' => ['availability', 'text'],
        'Funding speed' => ['speed', 'text'],
        'Cost' => ['cost', 'text'],
        'Best for' => ['bestFor', 'text'],
        'Description' => ['description', 'text'],
        'Featured rank' => ['rank', 'number'],
        'Website' => ['website', 'url'],
        'Affiliate link' => ['affiliate', 'url'],
        'Last verified' => ['verified', 'text'],
    ],
    'cards' => [
        'ID' => ['id', 'text'],
        'Name' => ['name', 'text'],
        'Issuer' => ['issuer', 'text'],
        'Show on site' => ['show', 'text'],
        'Tags' => ['tags', 'text'],
        'Best for' => ['bestFor', 'text'],
        'Description' => ['description', 'text'],
        'Featured rank' => ['rank', 'number'],
        'Website' => ['website', 'url'],
        'Affiliate link' => ['affiliate', 'url'],
        'Last verified' => ['verified', 'text'],
    ],
];

function parse_csv(string $csv): array
{
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $csv);
    rewind($stream);
    $rows = [];
    while (($row = fgetcsv($stream, 0, ',', '"', '')) !== false) {
        $rows[] = $row;
    }
    fclose($stream);
    return $rows;
}

function to_number(string $value): ?int
{
    $digits = preg_replace('/[^0-9.\-]/', '', $value);
    return ($digits === '' || !is_numeric($digits)) ? null : (int) round((float) $digits);
}

function to_url(string $value): ?string
{
    $value = trim($value);
    return preg_match('#^https?://#i', $value) && filter_var($value, FILTER_VALIDATE_URL) ? $value : null;
}

function normalize(string $set, string $csv): array
{
    $rows = parse_csv($csv);
    if (count($rows) < 2) {
        throw new RuntimeException('empty sheet');
    }
    $header = array_map(fn ($h) => trim((string) $h), array_shift($rows));
    $index = [];
    foreach (COLUMNS[$set] as $title => $spec) {
        $pos = array_search($title, $header, true);
        if ($pos !== false) {
            $index[$title] = $pos;
        }
    }
    if (!isset($index['ID'], $index['Name'], $index['Show on site'])) {
        throw new RuntimeException('missing required columns');
    }

    $items = [];
    foreach ($rows as $row) {
        $item = [];
        foreach (COLUMNS[$set] as $title => [$key, $type]) {
            $raw = isset($index[$title]) ? trim((string) ($row[$index[$title]] ?? '')) : '';
            $item[$key] = match ($type) {
                'number' => to_number($raw),
                'url' => to_url($raw),
                default => $raw === '' ? null : mb_substr($raw, 0, 400),
            };
        }
        if (!$item['id'] || !$item['name']) {
            continue;
        }
        if (strtolower((string) $item['show']) !== 'yes') {
            continue;
        }
        if (strtolower((string) ($item['status'] ?? '')) === 'closed') {
            continue;
        }
        unset($item['show']);
        $items[] = $item;
    }

    usort($items, function ($a, $b) {
        $ra = $a['rank'] ?? PHP_INT_MAX;
        $rb = $b['rank'] ?? PHP_INT_MAX;
        return $ra <=> $rb ?: strcasecmp($a['name'], $b['name']);
    });
    return $items;
}

function fetch_source(string $source): ?string
{
    if ($source === '') {
        return null;
    }
    if (!preg_match('#^https://docs\.google\.com/#', $source)) {
        return null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 6, 'follow_location' => 1, 'user_agent' => 'iBCB-HUB']]);
    $body = @file_get_contents($source, false, $ctx);
    return ($body === false || $body === '') ? null : $body;
}

function respond(array $payload, int $maxAge): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . $maxAge);
    header('X-Robots-Tag: noindex');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Command line: build the saved copy from a CSV file.
if (PHP_SAPI === 'cli') {
    [$script, $set, $file] = $argv + [null, null, null];
    if (!isset(COLUMNS[$set]) || !is_file((string) $file)) {
        fwrite(STDERR, "usage: php data.php lenders|cards file.csv\n");
        exit(1);
    }
    echo json_encode(['items' => normalize($set, (string) file_get_contents($file))],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
    exit;
}

$set = (string) ($_GET['set'] ?? '');
if (!isset(COLUMNS[$set])) {
    http_response_code(400);
    respond(['error' => 'unknown set'], 0);
}

$config = require __DIR__ . '/config.php';
$ttl = (int) ($config['cache_ttl'] ?? 600);
$cacheDir = __DIR__ . '/cache';
$cacheFile = $cacheDir . '/' . $set . '.json';

// 1. Fresh cache.
if (is_file($cacheFile) && time() - filemtime($cacheFile) < $ttl) {
    $cached = json_decode((string) file_get_contents($cacheFile), true);
    if (is_array($cached)) {
        respond($cached, 300);
    }
}

// 2. Google Sheet.
$csv = fetch_source((string) ($config['sources'][$set] ?? ''));
if ($csv !== null) {
    try {
        $payload = ['source' => 'sheet', 'updated' => gmdate('c'), 'items' => normalize($set, $csv)];
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755);
        }
        @file_put_contents($cacheFile, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        respond($payload, 300);
    } catch (Throwable $e) {
        // Fall through to the copies below.
    }
}

// 3. Stale cache.
if (is_file($cacheFile)) {
    $cached = json_decode((string) file_get_contents($cacheFile), true);
    if (is_array($cached)) {
        $cached['source'] = 'cache';
        respond($cached, 60);
    }
}

// 4. Saved copy shipped with the site.
$saved = dirname(__DIR__) . '/data/' . $set . '.json';
$copy = is_file($saved) ? json_decode((string) file_get_contents($saved), true) : null;
if (is_array($copy)) {
    $copy['source'] = 'saved copy';
    respond($copy, 60);
}

http_response_code(503);
respond(['error' => 'data unavailable', 'items' => []], 0);
