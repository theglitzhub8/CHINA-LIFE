<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';cl_methods(['POST']);$input=cl_body();$peer=cl_peer($input['peer']??null);
if (!is_bool($input['blocked']??null)) cl_fail('Choose block or unblock');
cl_rate('block',20,60);[$first,$second]=cl_pair($uid,$peer);
$db->begin_transaction();
if ($input['blocked']) {
    cl_run('INSERT IGNORE INTO chinalife_blocks(owner_id,peer_id) VALUES(?,?)','ii',[$uid,$peer]);
    cl_run('DELETE FROM chinalife_friends WHERE first_id=? AND second_id=?','ii',[$first,$second]);
} else cl_run('DELETE FROM chinalife_blocks WHERE owner_id=? AND peer_id=?','ii',[$uid,$peer]);
$db->commit();json_response('success',['ok'=>true]);
