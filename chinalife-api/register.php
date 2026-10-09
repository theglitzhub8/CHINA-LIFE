<?php
declare(strict_types=1);
// Sign-up from the ChinaLife game. Hafrik's own auth/register.php does all the work (validation, the account,
// any email confirmation); it just sends no CORS headers, so browsers on china-life.hafrik.com cannot call it.
// This file answers the browser's CORS check for the game's own origins and then runs Hafrik's register.php
// unchanged in the same request. No login is needed (people signing up do not have one yet).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ['https://china-life.hafrik.com','https://hafrik.com','https://www.hafrik.com'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Vary: Origin');
}
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {http_response_code(204); exit;}
if ($method !== 'POST') {http_response_code(405); header('Allow: POST, OPTIONS'); header('Content-Type: application/json'); echo '{"status":"error","message":"Method not allowed","data":null}'; exit;}
$hafrik = __DIR__ . '/../auth/register.php';
if (!is_file($hafrik)) {http_response_code(503); header('Content-Type: application/json'); echo '{"status":"error","message":"Sign-up is not available right now","data":null}'; exit;}
// Hafrik's script resolves its includes from api/v4/auth; run it from there so relative paths still work.
chdir(dirname($hafrik));
require $hafrik;
