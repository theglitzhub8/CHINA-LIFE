<?php
declare(strict_types=1);
// The University Years settings every device needs (appadmin University tab): the allowance, campus store prices and
// the wardrobe locks. Read by public/uni-settings.js while uni_food or wardrobe_locks is on.
require_once __DIR__.'/common.php';require_once __DIR__.'/university-settings.php';
cl_methods(['GET']);cl_rate('uni_settings',30,60);
json_response('success',cl_uni_public());
