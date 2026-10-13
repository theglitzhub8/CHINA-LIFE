<?php
declare(strict_types=1);
// Only named Hafrik workflows are exposed; no arbitrary file paths or URLs.
require_once __DIR__.'/common.php';
$routes = [
 'businesses'=>['business/list.php','GET'], 'business'=>['business/view.php','GET'], 'business_follow'=>['business/follow.php','POST'],
 'spaces'=>['communities/list.php','GET'], 'space'=>['communities/view.php','GET'], 'space_join'=>['communities/join.php','POST'], 'space_leave'=>['communities/leave.php','POST'],
 'people'=>['people/list.php','GET'], 'people_follow'=>['people/follow_toggle.php','POST'],
 'academy'=>['hafrikx/academy/courses.php','GET'], 'course'=>['hafrikx/academy/course-detail.php','GET'], 'course_apply'=>['hafrikx/academy/apply.php','POST'],
 'events'=>['events/list.php','GET'], 'event'=>['events/detail.php','GET'], 'event_rsvp'=>['events/rsvp.php','POST'],
 'marketplace'=>['marketplace/get_marketplace.php','GET'], 'product'=>['marketplace/get_product.php','GET'],
 'exchange'=>['exchange/rates_get.php','GET'], 'exchange_quote'=>['exchange/quote.php','GET'], 'exchange_orders'=>['exchange/orders_my.php','GET'],
];
$action = $_GET['action'] ?? '';
if (!is_string($action) || !isset($routes[$action])) cl_fail('Unknown Hafrik action',404);
[$path,$verb] = $routes[$action];cl_methods([$verb]);
$feature=match(explode('/',$path)[0]){'business'=>'business','communities'=>'space','people'=>'people','hafrikx'=>'course','events'=>'event','marketplace'=>'product','exchange'=>'exchange'};
cl_hafrik_require($feature);
$file = __DIR__.'/../'.$path;
if (!is_file($file)) cl_fail('This Hafrik feature is temporarily unavailable',503);
if ($verb === 'POST') {
    cl_rate('hafrik_action',30,60);
    // Serialize repeated account actions even when several game tabs submit together.
    $clSyncLockDb=$db;$clSyncLock='cl_hafrik_'.$uid;
    $lock=$clSyncLockDb->prepare('SELECT GET_LOCK(?,5)');$lock->bind_param('s',$clSyncLock);$lock->execute();
    $locked=(int)$lock->get_result()->fetch_row()[0];$lock->close();
    if ($locked!==1) cl_fail('Another request is being processed. Try again',409);
    register_shutdown_function(function() use($clSyncLockDb,$clSyncLock){$q=$clSyncLockDb->prepare('SELECT RELEASE_LOCK(?)');$q->bind_param('s',$clSyncLock);$q->execute();$q->close();});
}
// Some installed modules send their own CORS headers. Reapply ours before output is flushed.
ob_start();
register_shutdown_function(function(){if(!headers_sent()){cl_browser_cors();header('Cache-Control: no-store');}});
require $file;
