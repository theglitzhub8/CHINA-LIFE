<?php
declare(strict_types=1);
// Public banner image for a paid ad (shown on venue walls). No login: images load in <img> and WebGL textures,
// which cannot send the Hafrik token. Only images of active ads are served, with the stored type only.
require_once __DIR__.'/../db.php';
require_once __DIR__.'/../helpers.php';
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Cross-Origin-Resource-Policy: cross-origin');
$id=filter_var($_GET['id']??null,FILTER_VALIDATE_INT);
if(!$id){http_response_code(404);exit;}
$db=get_db_connection();
$q=$db->prepare('SELECT image,mime FROM chinalife_ads WHERE id=? AND active=1 AND ends_at>NOW()');$q->bind_param('i',$id);$q->execute();$row=$q->get_result()->fetch_assoc();$q->close();
if(!$row||!in_array($row['mime'],['image/png','image/jpeg','image/webp'],true)){http_response_code(404);exit;}
header('Content-Type: '.$row['mime']);
header('Cache-Control: public, max-age=86400');
header('Content-Length: '.strlen($row['image']));
echo $row['image'];
