<?php
/**
 * iBCB-HUB data sources.
 *
 * Each tab of the Google Sheet "iBCB-HUB — Base de données (prêteurs et cartes)"
 * is published to the web as CSV (File > Share > Publish to web). Paste the
 * published CSV link of each tab below. While a link is empty, the site uses
 * the copy saved in /ibcb-hub/data/.
 */

return [
    'sources' => [
        'lenders' => '',
        'cards'   => '',
    ],
    // How long a downloaded copy is reused before asking Google again (seconds).
    'cache_ttl' => 600,
];
