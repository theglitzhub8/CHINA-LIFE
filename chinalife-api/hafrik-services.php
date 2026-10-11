<?php
declare(strict_types=1);
// Reuse Hafrik's services workflow with ChinaLife's credentialed browser CORS.
require_once __DIR__.'/common.php';
$endpoint = $_GET['endpoint'] ?? '';
$allowed = ['list'=>'GET', 'detail'=>'GET', 'my_applications'=>'GET', 'get_application'=>'GET', 'apply'=>'POST'];
if (!is_string($endpoint) || !isset($allowed[$endpoint])) cl_fail('Unknown service action', 404);
cl_methods([$allowed[$endpoint]]);
if ($endpoint === 'apply') cl_rate('hafrik-service', 5, 600);
$file = __DIR__.'/../services/'.$endpoint.'.php';
if (!is_file($file)) cl_fail('Hafrik services are temporarily unavailable', 503);
require $file;
