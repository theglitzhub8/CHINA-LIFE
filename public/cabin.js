// v10 Stage E: plane cabin view. A light HTML overlay shown during flights (economy or private jet);
// windows scroll clouds and the ground, a moving-map strip tracks progress. No 3D cost while it is open.
(()=>{let el=null;
 const seats=jet=>{let s='';const rows=jet?3:6;for(let r=0;r<rows;r++)s+='<div class="cab-row">'+(jet?'<i class="lux"></i><span class="aisle"></span><i class="lux"></i>':'<i></i><i></i><i></i><span class="aisle"></span><i></i><i></i><i></i>')+'</div>';return s};
 function open({jet=false,from='',to='',label=''}={}){close();el=document.createElement('div');el.id='cabinView';el.className='cabin'+(jet?' jet':'');
  el.innerHTML='<div class="cab-top"><b>'+(jet?'🛩️ Private jet':'✈️ Cabin')+'</b><span id="cabPhase">Boarding</span><button id="cabClose" aria-label="Close cabin view">Outside view</button></div>'+
  '<div class="cab-windows">'+Array.from({length:jet?3:4},()=>'<div class="win"><div class="sky"><div class="cloud c1"></div><div class="cloud c2"></div><div class="ground"></div></div></div>').join('')+'</div>'+
  '<div class="cab-map"><span>'+from+'</span><div class="track"><i id="cabPlane">✈</i></div><span>'+to+'</span></div>'+
  (jet?'<div class="cab-perks"><span>🥂 Champagne</span><span>🛋️ Leather seats</span><span>📶 Wi-Fi</span></div>':'')+
  '<div class="cab-seats">'+seats(jet)+'</div>';
  document.body.appendChild(el);el.querySelector('#cabClose').onclick=close}
 function progress(p,phase){if(!el)return;const pl=el.querySelector('#cabPlane');pl.style.left=(Math.max(0,Math.min(1,p))*100)+'%';if(phase)el.querySelector('#cabPhase').textContent=phase;const alt=p<.15?(p/.15):p>.85?((1-p)/.15):1;el.style.setProperty('--alt',alt.toFixed(2))}
 function close(){el?.remove();el=null}
 window.ChinaLifeCabin={open,progress,close,get open_(){return !!el}};
})();
