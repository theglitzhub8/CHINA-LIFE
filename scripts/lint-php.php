<?php
$failed=false;
foreach(glob(__DIR__.'/../chinalife-api/*.php') as $file){passthru(escapeshellarg(PHP_BINARY).' -l '.escapeshellarg($file),$code);if($code!==0)$failed=true;}
exit($failed?1:0);
