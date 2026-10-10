import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('deployment preserves server credentials and excludes archives and private local configuration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-deploy-'));
 try{
  const source=path.join(root,'source'),host=path.join(root,'host'),game=path.join(root,'game');
  for(const dir of ['scripts','public','chinalife-api','landing/how-to-play'])fs.mkdirSync(path.join(source,dir),{recursive:true});
  fs.copyFileSync('scripts/deploy-php.sh',path.join(source,'scripts/deploy-php.sh'));
  fs.copyFileSync('chinalife-api/.htaccess',path.join(source,'chinalife-api/.htaccess'));
  for(const file of ['index.html','game.js'])fs.writeFileSync(path.join(source,'public',file),'fixture');
  for(const file of ['save.php','shared-config.php','studio-config.php','fortune-config.php','services-config.php','ai-config.php','music-config.php','turn-config.php','Archive.zip','backup.bak','polling-config.json','.env'])fs.writeFileSync(path.join(source,'chinalife-api',file),'local fixture');
  fs.mkdirSync(path.join(host,'api/v4/chinalife'),{recursive:true});
  for(const file of ['db.php','helpers.php'])fs.writeFileSync(path.join(host,'api/v4',file),'server fixture');
  fs.writeFileSync(path.join(host,'api/v4/chinalife/ai-config.php'),'existing server configuration');
  execFileSync('bash',[path.join(source,'scripts/deploy-php.sh'),host,game]);
  const deployed=path.join(host,'api/v4/chinalife');
  assert.equal(fs.readFileSync(path.join(deployed,'ai-config.php'),'utf8'),'existing server configuration');
  for(const file of ['music-config.php','turn-config.php','Archive.zip','backup.bak','polling-config.json','.env'])assert.equal(fs.existsSync(path.join(deployed,file)),false,file);
  for(const file of ['save.php','shared-config.php','studio-config.php','fortune-config.php','services-config.php','.htaccess'])assert.ok(fs.existsSync(path.join(deployed,file)),file);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
