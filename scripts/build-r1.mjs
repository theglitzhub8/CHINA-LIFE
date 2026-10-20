// R1 front-end bundle: public/index.dev.html is the source; this writes public/index.html with
// 2 classic bundles (keeping inline scripts in place), 1 module bundle, 1 CSS bundle, all content-hashed.
// Rarely used files (admin weekly editor, flight cabin) are left out and loaded on demand.
import {fileURLToPath} from 'node:url';import fs from 'node:fs';import crypto from 'node:crypto';import * as esbuild from 'esbuild';
const P='public/',src=fs.readFileSync(P+'index.dev.html','utf8');
const LAZY=new Set(['weekly-admin.js','cabin.js']);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,10);
for(const f of fs.readdirSync(P))if(/^(core-[ab]|app|styles)\.[0-9a-f]{10}\.(js|css)$/.test(f))fs.rmSync(P+f);
const clean=s=>s.replace(/\?v=[^"']*/,'');
const write=(name,ext,code)=>{const f=name+'.'+hash(code)+'.'+ext;fs.writeFileSync(P+f,code);return f};
// Walk the tags in order. Classic external scripts are grouped between inline scripts; modules go into one entry.
const tagRe=/<script\b([^>]*)>([\s\S]*?)<\/script>|<link\b[^>]*rel="stylesheet"[^>]*>/g;let m,groups=[],cur=null,modules=[],css=[];const plan=[];
while((m=tagRe.exec(src))){const tag=m[0];
 if(tag.startsWith('<link')){css.push(clean(tag.match(/href="([^"]+)"/)[1]));plan.push({tag,kind:'css'});continue}
 const attrs=m[1],s=attrs.match(/src="([^"]+)"/);
 if(!s){cur=null;plan.push({tag,kind:'inline'});continue}
 const file=clean(s[1]);
 if(/type="module"/.test(attrs)){modules.push(file);plan.push({tag,kind:'module'});continue}
 if(LAZY.has(file)){plan.push({tag,kind:'lazy'});continue}
 if(!cur){cur=[];groups.push(cur);plan.push({tag,kind:'group',group:cur})}else plan.push({tag,kind:'drop'});cur.push(file)}
// Classic groups: concatenated in order (they already share one global scope), minified without renaming globals.
const groupFiles=[];for(const [i,g] of groups.entries()){const code=g.map(f=>'/* '+f+' */\n'+fs.readFileSync(P+f,'utf8')+'\n;').join('\n');const out=(await esbuild.transform(code,{minify:true,target:'es2020',legalComments:'none'})).code;groupFiles.push(write(i?'core-b':'core-a','js',out))}
// Modules: one ESM bundle, imports evaluated in the original tag order.
const strip={name:'strip-query',setup(b){b.onLoad({filter:/cloud\.js$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace(/^await window\.ChinaLifeCloud\.ready;$/m,'/* top-level await dropped in the bundle: it would hold every later module until sign-in */'),loader:'js'}));b.onResolve({filter:/\?v=/},a=>({path:fileURLToPath(new URL(a.path.replace(/\?.*$/,''),'file://'+a.resolveDir+'/'))}))}};
const entry=modules.map(f=>"import './"+f+"';").join('\n');
const r=await esbuild.build({stdin:{contents:entry,resolveDir:fs.realpathSync(P),sourcefile:'entry.js'},bundle:true,format:'esm',minify:true,target:'es2020',write:false,plugins:[strip],legalComments:'none'});
const appFile=write('app','js',r.outputFiles[0].text);
const cssCode=(await esbuild.transform(css.map(f=>fs.readFileSync(P+f,'utf8')).join('\n'),{loader:'css',minify:true})).code;const cssFile=write('styles','css',cssCode);
// Rebuild the page: first CSS link becomes the bundle, first classic tag of each group becomes its bundle, first module becomes app.
let out=src,firstCss=true,firstModule=true,gi=0;for(const p of plan){let rep='';
 if(p.kind==='css'){rep=firstCss?'<link rel="stylesheet" href="'+cssFile+'" />':'';firstCss=false}
 else if(p.kind==='inline'||p.kind==='lazy')continue;
 else if(p.kind==='group')rep='<script src="'+groupFiles[gi++]+'"></script>';
 else if(p.kind==='module'){rep=firstModule?'<script type="module" src="'+appFile+'"></script>':'';firstModule=false}
 out=out.replace(p.tag,rep)}
for(const p of plan)if(p.kind==='lazy')out=out.replace(p.tag,'');
out=out.replace('<!-- r1:lazy -->','');
fs.writeFileSync(P+'index.html','<!-- Built by scripts/build-r1.mjs from index.dev.html. Edit index.dev.html, then run: node scripts/build-r1.mjs -->\n'+out);
const kb=f=>Math.round(fs.statSync(P+f).size/1024);console.log({groups:groups.map(g=>g.length),modules:modules.length,css:css.length,files:[...groupFiles,appFile,cssFile].map(f=>f+' '+kb(f)+' KB')});
