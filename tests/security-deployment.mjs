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
  for(const script of ['deploy-php.sh','hafrik-php.sh'])fs.copyFileSync('scripts/'+script,path.join(source,'scripts',script));
  fs.copyFileSync('chinalife-api/.htaccess',path.join(source,'chinalife-api/.htaccess'));
  for(const file of ['index.html','game.js'])fs.writeFileSync(path.join(source,'public',file),'fixture');
  for(const file of ['save.php','shared-config.php','studio-config.php','fortune-config.php','services-config.php','ai-config.php','music-config.php','turn-config.php','Archive.zip','backup.bak','polling-config.json','.env'])fs.writeFileSync(path.join(source,'chinalife-api',file),'local fixture');
  fs.mkdirSync(path.join(host,'api/v4/chinalife'),{recursive:true});
  for(const file of ['db.php','helpers.php'])fs.writeFileSync(path.join(host,'api/v4',file),'server fixture');
  fs.writeFileSync(path.join(source,'chinalife-api/migrate.php'),"<?php file_put_contents(__DIR__.'/migration-ran','yes');");
  fs.writeFileSync(path.join(host,'api/v4/chinalife/ai-config.php'),'existing server configuration');
  execFileSync('bash',[path.join(source,'scripts/deploy-php.sh'),host,game]);
  const deployed=path.join(host,'api/v4/chinalife');assert.equal(fs.readFileSync(path.join(deployed,'migration-ran'),'utf8'),'yes');
  assert.equal(fs.readFileSync(path.join(deployed,'ai-config.php'),'utf8'),'existing server configuration');
  for(const file of ['music-config.php','turn-config.php','Archive.zip','backup.bak','polling-config.json','.env'])assert.equal(fs.existsSync(path.join(deployed,file)),false,file);
  for(const file of ['save.php','shared-config.php','studio-config.php','fortune-config.php','services-config.php','.htaccess'])assert.ok(fs.existsSync(path.join(deployed,file)),file);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('deployment stops before publishing clients when migration fails',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-migrate-fail-'));try{
  const source=path.join(root,'source'),host=path.join(root,'host'),game=path.join(root,'game');for(const dir of ['scripts','public','chinalife-api','landing/how-to-play'])fs.mkdirSync(path.join(source,dir),{recursive:true});fs.mkdirSync(path.join(host,'api/v4'),{recursive:true});fs.mkdirSync(game);
  for(const script of ['deploy-php.sh','hafrik-php.sh'])fs.copyFileSync('scripts/'+script,path.join(source,'scripts',script));for(const file of ['db.php','helpers.php'])fs.writeFileSync(path.join(host,'api/v4',file),'fixture');fs.writeFileSync(path.join(source,'public/index.html'),'new client');fs.writeFileSync(path.join(game,'index.html'),'old client');fs.writeFileSync(path.join(source,'chinalife-api/migrate.php'),'<?php fwrite(STDERR,"Migration failed deliberately\\n");exit(1);');
  assert.throws(()=>execFileSync('bash',[path.join(source,'scripts/deploy-php.sh'),host,game],{stdio:'pipe'}));assert.equal(fs.readFileSync(path.join(game,'index.html'),'utf8'),'old client');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('PHP runtime selection rejects incompatible explicit binary and chooses a compatible one',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'chinalife-php-select-'));try{
  fs.mkdirSync(path.join(root,'vendor/composer'),{recursive:true});fs.writeFileSync(path.join(root,'vendor/composer/platform_check.php'),'<?php if (!(PHP_VERSION_ID >= 80401)) {}');const old=path.join(root,'php-old'),good=path.join(root,'php-good');fs.writeFileSync(old,'#!/bin/sh\necho 80333\n',{mode:0o755});fs.writeFileSync(good,'#!/bin/sh\necho 80412\n',{mode:0o755});assert.throws(()=>execFileSync('bash',['scripts/hafrik-php.sh',root],{env:{...process.env,PHP_BIN:old},stdio:'pipe'}),/No compatible PHP CLI/);assert.equal(execFileSync('bash',['scripts/hafrik-php.sh',root],{env:{...process.env,PHP_BIN:good},encoding:'utf8'}).trim(),good);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
