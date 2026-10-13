// v10: the voting centre shows the ballot on the wall (nominees with photos and live votes) and an on-screen panel.
// Data comes from politics.php; voting still goes through the City Hall ballot (game.politics), which confirms first.
const OFFICES={'governor':['Governor','🏛️'],'deputy-governor':['Deputy Governor','🤝'],'city-councillor':['City Councillor','🏙️'],'student-representative':['Student Rep','🎓']};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hue=n=>{let h=0;for(const ch of String(n))h=(h*31+ch.charCodeAt(0))%360;return h};
const initials=n=>String(n||'?').split(/[\s_.-]+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'?';
export function votingCentre(c){
 const {THREE,root,game}=c,city=game.state.city,disposers=[];
 const cv=document.createElement('canvas');cv.width=1024;cv.height=576;const x=cv.getContext('2d');
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const g=new THREE.PlaneGeometry(3.3,1.86),m=new THREE.MeshBasicMaterial({map:tex});disposers.push(tex,g,m);
 const board=new THREE.Mesh(g,m);board.position.set(3.6,2.35,-4.76);board.userData.signText='Live results';root.add(board);
 const photos=new Map();
 function photo(url){if(!url)return null;if(!photos.has(url)){const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{img.ok=true;draw()};img.onerror=()=>{img.ok=false};img.src=url;photos.set(url,img)}const i=photos.get(url);return i.ok?i:null}
 let data=null;
 function rows(){const out=[];for(const id of Object.keys(OFFICES)){const list=(data?.results||[]).filter(r=>r.office===id),total=list.reduce((n,r)=>n+Number(r.votes),0);list.slice(0,3).forEach(r=>out.push({...r,total,open:!!data?.elections?.[id]}))}return out}
 function draw(){x.fillStyle='#0f2a33';x.fillRect(0,0,1024,576);x.fillStyle='#e8c46a';x.font='900 44px system-ui,sans-serif';x.textAlign='left';x.fillText('🗳 '+city+' · Live results',36,64);
  if(!data){x.fillStyle='#cfe3e6';x.font='600 30px system-ui';x.fillText('Loading the ballot…',36,140);tex.needsUpdate=true;return}
  const offices=Object.keys(OFFICES);offices.forEach((id,col)=>{const ox=24+(col%2)*500,oy=96+Math.floor(col/2)*240,list=(data.results||[]).filter(r=>r.office===id),total=list.reduce((n,r)=>n+Number(r.votes),0),open=!!data.elections?.[id];
   x.fillStyle='#163b46';x.fillRect(ox,oy,476,224);x.fillStyle='#fff';x.font='800 28px system-ui';x.fillText(OFFICES[id][1]+' '+OFFICES[id][0],ox+16,oy+38);x.fillStyle=open?'#5fe0a4':'#9fb6bb';x.font='700 20px system-ui';x.textAlign='right';x.fillText(open?'VOTING OPEN':'CLOSED',ox+460,oy+36);x.textAlign='left';
   if(!list.length){x.fillStyle='#9fb6bb';x.font='600 22px system-ui';x.fillText('No nominees yet',ox+16,oy+90)}
   list.slice(0,3).forEach((r,i)=>{const y=oy+58+i*54,pct=total?Math.round(r.votes*100/total):0,img=photo(r.photo);x.save();x.beginPath();x.arc(ox+38,y+22,21,0,Math.PI*2);x.clip();if(img){try{x.drawImage(img,ox+17,y+1,42,42)}catch{}}else{x.fillStyle='hsl('+hue(r.name)+' 55% 45%)';x.fillRect(ox+17,y+1,42,42);x.fillStyle='#fff';x.font='800 18px system-ui';x.textAlign='center';x.fillText(initials(r.name),ox+38,y+29);x.textAlign='left'}x.restore();
    x.fillStyle='#fff';x.font=(i===0&&total?'800 ':'600 ')+'22px system-ui';x.fillText(String(r.name).slice(0,18),ox+70,y+20);x.fillStyle='#24515d';x.fillRect(ox+70,y+30,300,10);x.fillStyle=i===0&&total?'#e8c46a':'#5fb5b8';x.fillRect(ox+70,y+30,300*pct/100,10);x.fillStyle='#cfe3e6';x.font='700 20px system-ui';x.textAlign='right';x.fillText(r.votes+' · '+pct+'%',ox+460,y+40);x.textAlign='left'})});
  try{tex.needsUpdate=true}catch{}}
 // A tainted canvas (photo host without CORS) can't be uploaded; redraw with initials only.
 const safeDraw=()=>{try{draw()}catch{}};
 draw();
 const panel=document.createElement('section');panel.className='vote-panel';panel.setAttribute('aria-label','Election');(document.getElementById('worldUI')||document.body).append(panel);
 // Start folded when the room panel is open so the two never cover the room together.
 let open=!document.getElementById('worldUI')?.classList.contains('dock-open');
 function renderPanel(){const list=rows(),voted=data?.voted_offices||[],openOffices=Object.keys(data?.elections||{});const ends=Object.values(data?.elections||{}).map(e=>Number(e.closes_ms)).filter(Boolean).sort((a,b)=>a-b)[0];
  const left=ends?Math.max(0,Math.ceil((ends-Date.now())/60000)):0;
  panel.innerHTML='<button class="vote-head" aria-expanded="'+open+'"><b>🗳 '+(openOffices.length?'Election week':'Polls closed')+'</b><small>'+(ends?'Closes in '+Math.floor(left/1440)+'d '+Math.floor(left%1440/60)+'h':'Results')+' · '+voted.length+'/'+openOffices.length+' voted</small><i>'+(open?'▾':'▸')+'</i></button>'
   +(open?'<div class="vote-list">'+(data?list.length?list.map(r=>{const pct=r.total?Math.round(r.votes*100/r.total):0,did=voted.includes(r.office);return '<article><span class="vote-ava" style="--h:'+hue(r.name)+'">'+(r.photo?'<img src="'+esc(r.photo)+'" alt="" loading="lazy" onerror="this.remove()">':'')+esc(initials(r.name))+'</span><div><b>'+esc(r.name)+'</b><small>'+OFFICES[r.office][1]+' '+OFFICES[r.office][0]+' · '+r.votes+' votes · '+pct+'%</small><i style="width:'+pct+'%"></i></div>'+(did?'<em>✓ Voted</em>':r.open&&!window.ChinaLifeFlags?.off('politics')?'<button data-vote-cand="'+esc(r.id)+'">Vote</button>':r.open?'<em>View only</em>':'<em>Closed</em>')+'</article>'}).join(''):'<p>No nominees yet. Stand for election at City Hall.</p>':'<p>Loading…</p>')+'</div>':'');
  panel.querySelector('.vote-head').onclick=()=>{open=!open;renderPanel()};
  panel.querySelectorAll('[data-vote-cand]').forEach(b=>b.onclick=()=>game.politics(city,b.dataset.voteCand))}
 renderPanel();
 let alive=true;
 async function refresh(){if(!alive||document.hidden)return;try{const r=await window.ChinaLifeAuth.request('/chinalife/politics.php?city='+encodeURIComponent(city));if(!alive)return;data=r.data||r;safeDraw();renderPanel()}catch{if(!data){data={results:[],elections:{}};safeDraw();renderPanel()}}}
 refresh();const poll=setInterval(refresh,20000);
 // Re-read after a vote: the ballot dialog closing is the signal.
 const dlg=document.getElementById('activityDialog'),onClose=()=>setTimeout(refresh,300);dlg?.addEventListener('close',onClose);
 window.ChinaLifeVoteBoard=cv;return {tick(){},dispose(){alive=false;window.ChinaLifeVoteBoard=null;clearInterval(poll);dlg?.removeEventListener('close',onClose);panel.remove();for(const d of disposers)d.dispose()},keep:[board],refresh};
}
