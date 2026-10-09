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
 }catch(error){console.debug('Message notification check:',error.message);return false}finally{polling=false}
}
window.addEventListener('chinalife:cloudready',()=>{generation++;cursor=null;accountId='';banner.hidden=true;pollMessages()});
// Batch 1: every 30 s as a safety net, and at once when the heartbeat reports a new message for me or my venue
// (cloud.js kicks this loop). Legacy mode and older setups keep the 1 s check.
if(window.ChinaLifePoll){window.ChinaLifePoll.loop('notifications',pollMessages,{every:30000,legacyEvery:1000});window.addEventListener('chinalife:update',()=>{const room=game.state.city+':'+game.state.place;if(room!==lastRoom){lastRoom=room;window.ChinaLifePoll.kick('notifications',600)}})}else setInterval(pollMessages,1000);
let lastRoom='';window.ChinaLifeNotifications={poll:pollMessages};pollMessages();
