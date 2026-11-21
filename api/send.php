<?php
/**
 * iBCB-HUB form handler.
 * Receives the Contact, Funding request and RocketMail early-access forms,
 * emails them to the iBCB inbox, and shows a confirmation page.
 */

declare(strict_types=1);

const RECIPIENT = 'supportbcb@ibcb-s.com';
const SENDER    = 'no-reply@ibcb-2.com';

const FORMS = [
    'contact' => [
        'label'    => 'Contact message',
        'required' => ['name', 'email', 'subject', 'message'],
        'fields'   => ['name' => 'Name', 'email' => 'Email', 'subject' => 'Subject', 'message' => 'Message'],
        'back'     => '/ibcb-hub/contact/',
        'thanks'   => 'Thanks for your message. We will reply by email, usually within two business days.',
    ],
    'funding' => [
        'label'    => 'Funding request',
        'required' => ['name', 'email', 'revenue', 'amount'],
        'fields'   => ['name' => 'Full name', 'email' => 'Email', 'phone' => 'Phone', 'revenue' => 'Monthly revenue', 'amount' => 'Funding amount needed'],
        'back'     => '/ibcb-hub/tools/brokerage/',
        'thanks'   => 'Thanks, your funding request has been received. We will review it and email you with options that may fit your business.',
    ],
    'rocketmail' => [
        'label'    => 'RocketMail early access',
        'required' => ['name', 'email'],
        'fields'   => ['name' => 'Name', 'email' => 'Email', 'message' => 'Planned use'],
        'back'     => '/ibcb-hub/rocketmail/',
        'thanks'   => 'You are on the RocketMail early access list. We will email you as soon as your access is ready.',
    ],
];

function clean(string $value, int $max): string
{
    $value = trim(str_replace("\0", '', $value));
    return mb_substr($value, 0, $max);
}

function one_line(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value));
}

function render(int $status, string $title, string $bodyHtml): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex');
    $tpl = (string) file_get_contents(__DIR__ . '/page.tpl');
    echo str_replace(['{{TITLE}}', '{{BODY}}'], [htmlspecialchars($title), $bodyHtml], $tpl);
    exit;
}

function message_page(int $status, string $kicker, string $title, string $text, string $back, string $backLabel): void
{
    $body = '    <section class="page-hero">' . "\n"
        . '      <p class="page-kicker">' . htmlspecialchars($kicker) . '</p>' . "\n"
        . '      <h1>' . htmlspecialchars($title) . '</h1>' . "\n"
        . '      <p class="page-lead">' . htmlspecialchars($text) . '</p>' . "\n"
        . '      <div class="page-actions">' . "\n"
        . '        <a class="page-btn primary" href="' . htmlspecialchars($back) . '">' . htmlspecialchars($backLabel) . '</a>' . "\n"
        . '        <a class="page-btn secondary" href="/ibcb-hub/tools/">Browse tools</a>' . "\n"
        . '      </div>' . "\n"
        . '    </section>';
    render($status, $title, $body);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /ibcb-hub/contact/', true, 303);
    exit;
}

$type = (string) ($_POST['form_type'] ?? '');
if (!isset(FORMS[$type])) {
    message_page(400, 'Error', 'Something went wrong', 'This form could not be recognized. Please try again from the contact page.', '/ibcb-hub/contact/', 'Back to contact');
}
$form = FORMS[$type];

// Spam bots fill the hidden "website" field; people never see it.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    message_page(200, 'Thank you', 'Message received', $form['thanks'], $form['back'], 'Back');
}

$data = [];
foreach ($form['fields'] as $key => $label) {
    $max = in_array($key, ['message'], true) ? 5000 : 200;
    $data[$key] = clean((string) ($_POST[$key] ?? ''), $max);
}

$errors = [];
foreach ($form['required'] as $key) {
    if ($data[$key] === '') {
        $errors[] = $form['fields'][$key] . ' is required.';
    }
}
if ($data['email'] !== '' && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Please enter a valid email address.';
}
if ($errors) {
    message_page(422, 'Please check the form', 'Some information is missing', implode(' ', $errors) . ' Please go back and try again.', $form['back'], 'Go back to the form');
}

$lines = [];
foreach ($form['fields'] as $key => $label) {
    if ($data[$key] !== '') {
        $lines[] = $label . ': ' . ($key === 'message' ? "\n" . $data[$key] : one_line($data[$key]));
    }
}
$lines[] = '';
$lines[] = 'Sent from: ' . one_line((string) ($_SERVER['HTTP_REFERER'] ?? 'iBCB-HUB'));
$lines[] = 'Date: ' . gmdate('Y-m-d H:i') . ' UTC';

$subject = '[iBCB-HUB] ' . $form['label'] . ' - ' . one_line($data['name']);
$headers = [
    'From: iBCB-HUB <' . SENDER . '>',
    'Reply-To: ' . one_line($data['name']) . ' <' . one_line($data['email']) . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
];

$sent = mail(
    RECIPIENT,
    '=?UTF-8?B?' . base64_encode($subject) . '?=',
    implode("\n", $lines),
    implode("\r\n", $headers),
    '-f' . SENDER
);

if (!$sent) {
    message_page(500, 'Error', 'Your message could not be sent', 'Sorry, something went wrong on our side. Please email us directly at ' . RECIPIENT . '.', $form['back'], 'Back');
}

message_page(200, 'Thank you', 'Message received', $form['thanks'], $form['back'], 'Back');
