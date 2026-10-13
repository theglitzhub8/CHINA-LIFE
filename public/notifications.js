const game=window.ChinaLife;
let cursor=null,accountId='',polling=false,generation=0;
const banner=document.createElement('button');banner.id='messageNotification';banner.className='message-notification';banner.hidden=true;banner.setAttribute('aria-live','polite');document.body.append(banner);
let dismiss;
async function pollMessages(){
 const cloud=window.ChinaLifeCloud,id=cloud?.playerId;
 if(!cloud?.signedIn||!game.state.created||document.hidden||polling)return;
 if(id!==accountId){accountId=id;cursor=null;generation++;banner.hidden=true}
 const epoch=generation,room=game.state.city+':'+game.state.place;polling=true;
 try{
  const params=new URLSearchParams({city:game.state.city,place:game.state.place});if(cursor!==null)params.set('after',cursor);
  const response=await window.ChinaLifeAuth.request('/chinalife/notifications.php?'+params);
  if(epoch!==generation||id!==window.ChinaLifeCloud.playerId||room!==game.state.city+':'+game.state.place)return;
  const data=response.data||response;cursor=data.cursor;
  for(const message of data.messages||[]){
   banner.textContent=(message.channel==='direct'?'Private message':'Venue message')+' · '+message.name+': '+message.body;
   banner.hidden=false;banner.onclick=()=>{banner.hidden=true;message.channel==='direct'?window.ChinaLifeSocial?.openDirect(message.player_id):window.ChinaLifeSocial?.open('venue')};
   clearTimeout(dismiss);dismiss=setTimeout(()=>banner.hidden=true,10000);
  }
 }catch(error){console.debug('Message notification check:',error.message)}finally{polling=false}
}
window.addEventListener('chinalife:cloudready',()=>{generation++;cursor=null;accountId='';banner.hidden=true;pollMessages()});
setInterval(pollMessages,1000);window.ChinaLifeNotifications={poll:pollMessages};pollMessages();

// Persistent admin notices use their own overlay so chat/event toasts cannot replace them.
const notice=document.createElement('section');notice.hidden=true;notice.setAttribute('role','alertdialog');notice.setAttribute('aria-modal','true');notice.setAttribute('aria-label','Admin announcement');notice.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.65);padding:24px;overflow:auto';
const card=document.createElement('div');card.style.cssText='max-width:480px;margin:15vh auto;background:#fff;color:#17232a;border-radius:20px;padding:24px;box-shadow:0 16px 60px #0006';
const heading=document.createElement('h2'),copy=document.createElement('p'),board=document.createElement('button'),dismissNotice=document.createElement('button');copy.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';board.textContent='Open notice board';dismissNotice.textContent='Dismiss';board.className='primary-btn';dismissNotice.className='soft-btn';card.append(heading,copy,board,dismissNotice);notice.append(card);document.body.append(notice);
let noticeAccount='',noticeSeen=new Set(),currentNotice=null;
function showAnnouncement(){const cloud=window.ChinaLifeCloud,id=cloud?.playerId;if(!cloud?.signedIn){notice.hidden=true;return}if(id!==noticeAccount){noticeAccount=id;try{noticeSeen=new Set(JSON.parse(localStorage.getItem('chinalife-announcements-'+id)||'[]'))}catch{noticeSeen=new Set()}currentNotice=null;notice.hidden=true}if(!notice.hidden)return;const next=(cloud.announcements||[]).find(n=>!noticeSeen.has(String(n.id)));if(!next)return;currentNotice=String(next.id);heading.textContent='📢 '+next.title;copy.textContent=next.body;notice.hidden=false;dismissNotice.focus?.();}
function closeAnnouncement(){noticeSeen.add(currentNotice);try{localStorage.setItem('chinalife-announcements-'+noticeAccount,JSON.stringify([...noticeSeen].slice(-200)))}catch{}notice.hidden=true;showAnnouncement();}
dismissNotice.onclick=closeAnnouncement;board.onclick=()=>{closeAnnouncement();game.gist?.()};window.addEventListener('chinalife:events',showAnnouncement);window.addEventListener('chinalife:cloudready',showAnnouncement);window.ChinaLifeNotifications.showAnnouncements=showAnnouncement;showAnnouncement();
