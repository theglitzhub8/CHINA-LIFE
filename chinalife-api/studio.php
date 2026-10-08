<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['GET']);cl_rate('studio_catalog',60,60);
json_response('success',['catalog'=>require __DIR__.'/studio-config.php']);
