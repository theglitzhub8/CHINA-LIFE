<?php
declare(strict_types=1);
// Public photos for partner listings (menus, shops, events). Ids are random, so only people given a link can find
// a photo that is still waiting for review. No login: images load in <img> and cannot send the Hafrik token.
require_once __DIR__.'/../db.php';
require_once __DIR__.'/../helpers.php';
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Cross-Origin-Resource-Policy: cross-origin');
$id=(string)($_GET['id']??'');
if(!preg_match('/^[a-f0-9]{24}$/',$id)){http_response_code(404);exit;}
$db=get_db_connection();
$q=$db->prepare('SELECT bytes,mime FROM chinalife_media WHERE id=?');$q->bind_param('s',$id);$q->execute();$row=$q->get_result()->fetch_assoc();$q->close();
if(!$row||!in_array($row['mime'],['image/png','image/jpeg','image/webp'],true)){http_response_code(404);exit;}
header('Content-Type: '.$row['mime']);
header('Cache-Control: public, max-age=604800, immutable');
header('Content-Length: '.strlen($row['bytes']));
echo $row['bytes'];
