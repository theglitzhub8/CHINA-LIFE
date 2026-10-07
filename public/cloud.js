const game = window.ChinaLife, $ = id => document.getElementById(id);
const HAFRIK_API = 'https://hafrik.com/api/v4', TOKEN_KEY = 'chinalife-hafrik-token', PROFILE_KEY = 'chinalife-hafrik-profile';
const storage = {getItem(key) {try {return localStorage.getItem(key)} catch {return null}}, setItem(key, value) {try {localStorage.setItem(key, value)} catch {}}};
let account = null, remote = {state:null}, auto = false, busy = false, loading = true, timer, presence = false, players = [], epoch = 0, authEpoch = 0, polling = false;
let joining=null,sessionSource='browser',restoreFailed=false,appWaiting=false,appWait;
let presenceCheck={lastSuccess:null,error:null,serverId:null};
let message = 'Sign in with Hafrik to save across devices.', liveToken = storage.getItem(TOKEN_KEY) || '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, method = 'GET', data) {
  const query = method === 'GET' && data ? new URLSearchParams(data).toString() : '';
  const passwordLogin=path==='/auth/login.php';
  const response = await fetch(HAFRIK_API + path + (query ? (path.includes('?') ? '&' : '?') + query : ''), {
    method, credentials:passwordLogin || liveToken ? 'omit' : 'include', headers:{...(liveToken && !passwordLogin ? {Authorization:'Bearer ' + liveToken} : {}), ...(data && method !== 'GET' ? {'content-type':'application/json'} : {})},
    body:data && method !== 'GET' ? JSON.stringify(data) : undefined,
  });
  let result; try {result = await response.json()} catch {throw Error('Hafrik did not return JSON.')}
  if (!response.ok || result.status === 'error') throw Object.assign(Error(result.message || result.error || 'Hafrik request failed'), {status:response.status,data:result.data});
  return result;
}
function notify() {window.dispatchEvent(new CustomEvent('chinalife:cloudready'))}
function publish() {if($('onlineCount'))$('onlineCount').textContent=presence ? (players.filter(p=>p.city===game.state.city).length+1)+' online in this city' : 'Single-player';window.dispatchEvent(new CustomEvent('chinalife:players', {detail:window.ChinaLifeCloud.players}))}
function status(text) {message = text; $('cloudStatus').textContent = account ? 'Hafrik · ' + (account.username || account.user_name || 'Connected') : 'Sign in with Hafrik'; $('cloudStatus').title = text}
function multiplayerBlocker() {
  if(!account)return 'Sign in with Hafrik';
  if(loading)return 'Your account character is still loading';
  if(!auto)return 'Account character restore failed: '+message;
  if(!game.state.created)return 'Finish character setup to enter the shared world';
  if(document.hidden)return 'Return to the visible game';
  if(polling)return 'Waiting for the presence server response';
  if(presenceCheck.error)return presenceCheck.error;
  return presence?'none':'Waiting to join the shared world';
}
function multiplayerReport() {
  const world=window.ChinaLifeWorld,nearby=window.ChinaLifeCloud.players;
  return ['Account: '+(account?.user_id ?? account?.id ?? 'guest'),
    'Server account: '+(presenceCheck.serverId ?? 'not confirmed'),
    'Location: '+game.state.city+' / '+game.state.place,
    'Connection: '+(presence?'joined':'not joined'),
    'Join status: '+multiplayerBlocker(),
    'Character created: '+game.state.created,
    'Character loading: '+loading,
    'Account save ready: '+auto,
    'Story phase: '+(game.state.story?.phase || 'no campaign'),
    'Game visible: '+(!document.hidden),
    'View: '+(world?.view || '3D unavailable'),
    'Players received in city: '+players.length,
    'Players received in venue: '+nearby.length,
    'Avatars rendered: '+(world?.playerIds?.length ?? '3D unavailable'),
    'Last presence update: '+(presenceCheck.lastSuccess || 'none'),
    'Presence error: '+(presenceCheck.error || 'none')].join('\n');
}
function accountDetails() {return '<details class="account-details"><summary>Account & connection details</summary><p>Sign-in method: '+esc(sessionSource)+'</p><pre id="multiplayerReport"></pre><button id="multiplayerCheck" class="soft-btn">Check connection now</button>'+'<button id="hafrikLogout" class="soft-btn">Disconnect this game</button>'+'</details>'}
const inApp = () => !!(window.ReactNativeWebView || window.HafrikSession);
function requestAppSession() {
  if (!window.ReactNativeWebView) return;
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'chinalife:auth-request'}));
  clearTimeout(appWait); appWaiting = true; appWait = setTimeout(() => {appWaiting = false; if (!account && $('cloudDialog').open) show()}, 8000);
}
function show() {
  const name=esc(account?.username || account?.user_name || 'Hafrik user'), head='<span class="eyebrow">HAFRIK ACCOUNT</span>';
  const passwordForm='<form id="hafrikLoginForm" class="cloud-login"><label>Email or username<input id="hafrikLogin" autocomplete="username" required></label><label>Password<input id="hafrikPassword" type="password" autocomplete="current-password" required></label><button type="submit" class="primary-btn">Log in</button><p id="hafrikLoginFeedback" role="status"></p></form>';
  const conflict=!!account&&!auto&&!loading&&!restoreFailed;
  let html;
  if (account && restoreFailed) html=head+'<h2>Your character needs attention</h2><p class="account-identity">Signed in as <b>'+name+'</b></p><p>Your login worked, but your saved character could not be opened on this device. Nothing has been deleted from your account.</p><p class="account-error" role="alert">'+esc(message)+'</p><button id="cloudRetry" class="primary-btn">Try loading again</button><button id="cloudBackup" class="soft-btn">Download account backup</button>'+accountDetails();
  else if (conflict) html=head+'<h2>A newer save was found</h2><p class="account-identity">Signed in as <b>'+name+'</b></p><p>Your account has a newer save from another device. Load it to keep playing and saving.</p><button id="cloudLoad" class="primary-btn">Load newer save</button>'+accountDetails();
  else if (account) html=head+'<h2>Connected to Hafrik</h2><p class="account-identity">Signed in as <b>'+name+'</b></p><p>Your character saves to your Hafrik account automatically.</p><button id="cloudUpload" class="primary-btn">Save now</button>'+accountDetails();
  // Inside the app the native session is the only login; never ask for a web password first.
  else if (inApp()) html=head+(appWaiting||loading?'<h2>Connecting your Hafrik account…</h2><p>Getting your login from the Hafrik app.</p>':'<h2>Couldn’t get your Hafrik login</h2><p>The Hafrik app didn’t share your account with the game. Close ChinaLife and open it again from Hafrik. If it keeps happening, update the Hafrik app.</p>'+(message&&!/^Sign in with Hafrik/.test(message)?'<p class="account-error" role="alert">'+esc(message)+'</p>':''))+'<button id="hafrikConnect" class="primary-btn"'+(appWaiting?' disabled':'')+'>Try again</button><details class="account-details"><summary>Sign in with email or username instead</summary>'+passwordForm+'</details>';
  else html=head+'<h2>Save your ChinaLife</h2><p>Connect your Hafrik account to keep your character and progress across devices.</p><button id="hafrikConnect" class="primary-btn">Continue with Hafrik</button><p id="accountConnectFeedback" role="status"></p><details class="account-details"><summary>Use email or username</summary>'+passwordForm+'</details>';
  $('cloudContent').innerHTML=html;
  if (!$('cloudDialog').open) $('cloudDialog').showModal();
  if(account){
    $('multiplayerReport').textContent=multiplayerReport();
    $('multiplayerCheck').onclick=async()=>{await presenceHeartbeat();$('multiplayerReport').textContent=multiplayerReport();if(!loading&&auto&&!game.state.created){$('cloudDialog').close();game.startOnboarding()}};
    $('hafrikLogout').onclick=logout;
    if(restoreFailed){
      $('cloudRetry').onclick=async()=>{await connect(undefined,{source:sessionSource});if(!auto)show()};
      $('cloudBackup').disabled=!remote.state;
      $('cloudBackup').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(remote.state,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='chinalife-account-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    }else if(conflict){
      $('cloudLoad').disabled=!remote.state;
      $('cloudLoad').onclick=()=>{if(!remote.state)return;loading=true;try{game.loadSave(remote.state);auto=true;status('Connected. Your character saves automatically.')}catch(error){restoreFailed=true;status(error.message)}finally{loading=false}if(auto)$('cloudDialog').close();else show()};
    }else $('cloudUpload').onclick=()=>upload(true);
  }else{
    $('hafrikLoginForm').onsubmit=login;
    $('hafrikConnect').onclick=async()=>{
      if(window.ReactNativeWebView){requestAppSession();show()}
      else{await initialize();if(!account)$('accountConnectFeedback').textContent='No Hafrik session was found. Sign in on Hafrik or use email or username below.';else if(!auto)show()}
    };
  }
}
async function loadRemote() {
  const result = await api('/chinalife/save.php'), data = result.data || result;
  return {state:data.save?.game || data.state || null, updatedAt:data.updated_at, revision:data.revision ?? 0, account:data.account};
}
async function connect(session,{source}={}) {
  sessionSource=source || (session?.token && (window.HafrikSession||window.ReactNativeWebView)?'app':sessionSource);
  const guestStory=game.accountId==null&&game.state.created?JSON.parse(JSON.stringify(game.state)):null;
  presenceCheck={lastSuccess:null,error:null,serverId:null};
  const connectionGeneration = ++authEpoch; epoch++; clearTimeout(timer); presence = false; players = []; publish(); auto = false; loading = true; restoreFailed = false; clearTimeout(appWait); appWaiting = false;
  if (session?.token) liveToken = session.token;
  try {
    const saved = await loadRemote();
    if (connectionGeneration !== authEpoch) return false;
    const profile = saved.account || session?.user || (() => {try {return JSON.parse(storage.getItem(PROFILE_KEY))} catch {return null}})();
    // An account identifier is required to keep different users' device saves isolated.
    const id = profile?.user_id ?? profile?.id;
    if (id == null) throw Error('Your Hafrik session needs an account ID. Open the game from the app or sign in.');
    const nativeId=sessionSource==='app'?(session?.user?.user_id ?? session?.user?.id):null;
    if(nativeId!=null&&String(nativeId)!==String(id)){account=null;throw Error('The returned Hafrik account does not match your app account. Reopen ChinaLife from Hafrik.')}
    account = {...profile, signedIn:true}; storage.setItem(PROFILE_KEY, JSON.stringify(account));
    storage.setItem(TOKEN_KEY, sessionSource==='app'?'':liveToken);
    remote = saved; const hasLocal = game.setAccount(id,{loadLocal:!remote.state});
    if (remote.state) game.loadSave(remote.state);
    else if(guestStory&&!hasLocal)game.loadSave(guestStory);
    auto = true; loading = false;
    game.useAccountName(account.username || account.user_name);
    status('Connected. Your character saves automatically.'); notify();
    if (game.state.created) {if ((hasLocal||guestStory) && !remote.state) await upload(); await join()} else game.startOnboarding();
    if ($('cloudDialog').open) $('cloudDialog').close();
    return true;
  } catch (error) {
    if (connectionGeneration !== authEpoch) return false;
    loading = false; status(error.message);if(account){restoreFailed=true;notify();show()}
    // A failed restore must not silently replace an existing account character.
    if (error.status === 401) {liveToken = ''; storage.setItem(TOKEN_KEY, ''); account = null; notify()}
    return false;
  }
}
async function login(event) {
  event.preventDefault(); const feedback = $('hafrikLoginFeedback'),button=$('hafrikLoginForm').querySelector('button[type="submit"]');if(button.disabled)return;button.disabled=true;feedback.textContent = 'Connecting…';
  try {
    const result = await api('/auth/login.php', 'POST', {login:$('hafrikLogin').value.trim(), password:$('hafrikPassword').value});
    if (!result.data?.token) throw Error(result.message || 'Login failed');
    storage.setItem(TOKEN_KEY, result.data.token);
    if (!await connect({...result.data,token:result.data.session_token||result.data.token},{source:'password'})) {if(account)show();else feedback.textContent = message;}
  } catch (error) {feedback.textContent = error.message}
  finally {button.disabled=false}
}
async function logout() {
  authEpoch++; await leave(); auto = false; clearTimeout(timer); liveToken = ''; storage.setItem(TOKEN_KEY, ''); storage.setItem(PROFILE_KEY, '');
  account = null; remote = {state:null}; game.setAccount(null); notify(); status('Disconnected. Your account character is kept.'); game.startOnboarding(); show();
}
function scheduleSave() {clearTimeout(timer); timer = setTimeout(() => upload(), 1500)}
async function upload(manual = false) {
  if (!account || !auto || loading || busy || !game.state.created) return false;
  const generation = authEpoch, snapshot = JSON.parse(JSON.stringify(game.state)); busy = true;
  try {
    const {name, color, appearance, background, dream, trait} = snapshot;
    const result = await api('/chinalife/save.php', 'POST', {revision:remote.revision ?? 0,save:{character:{name,color,appearance,background,dream,trait},game:snapshot}});
    if (generation !== authEpoch) return false;
    remote = {state:snapshot,revision:result.data?.revision ?? (remote.revision ?? 0)+1,updatedAt:new Date().toISOString()}; status('Saved to Hafrik.');
    if (manual) game.toast('Character saved to your Hafrik account.');
    if (JSON.stringify(game.state) !== JSON.stringify(snapshot)) scheduleSave();
    return true;
  } catch (error) {
    if (generation !== authEpoch) return false;
    if (error.status === 409 && reconcileTransfers({state:error.data?.save?.game,revision:error.data?.revision})) {scheduleSave();return false}
    if (error.status === 409) {auto = false; remote = {state:error.data?.save?.game || null,revision:error.data?.revision ?? 0}; status('A newer account save exists. Open your account and load it to continue saving.'); show()}
    else if (error.status === 401) {auto = false; account = null; liveToken = ''; storage.setItem(TOKEN_KEY, ''); presence = false; players = []; publish(); notify(); status('Your Hafrik session expired. Connect again to save.'); show()}
    else {status('Account save failed: ' + error.message); if (auto) {clearTimeout(timer);timer=setTimeout(()=>upload(),10000)}}
    if (manual) game.toast(message); return false;
  } finally {busy = false}
}
function reconcileTransfers(saved) {
  const delta=(saved.state?.transferTotal||0)-(remote.state?.transferTotal||0);
  if(!delta)return false;
  game.state.money+=delta;game.state.transferTotal=saved.state.transferTotal;remote=saved;
  game.save();game.refresh?.();game.toast(delta>0?'Received ¥'+delta+' game coins.':'Game coin transfer completed.');
  return true;
}
async function syncTransfers(){if(!account||!auto||busy||loading||!game.state.created||document.hidden)return;const generation=authEpoch,revision=remote.revision;try{const saved=await loadRemote();if(generation===authEpoch&&!busy&&revision===remote.revision)reconcileTransfers(saved)}catch{}}
async function transfer(peer,amount,requestId){
  const generation=authEpoch;
  if(!await upload())throw Error('Wait for your account save to finish, then try again.');
  if(generation!==authEpoch)throw Error('Your account changed. Open the player again.');
  await api('/chinalife/transfers.php','POST',{peer,amount,request_id:requestId});
  await syncTransfers();
}
async function refreshPresence() {
  if (!account || !presence || !game.state.created || document.hidden || polling) return false;
  const generation = epoch, state = game.state, city = state.city, place = state.place, world = window.ChinaLifeWorld, position = world?.roomPosition ?? (world?.view==='venue'?world.position:null);
  polling = true;
  try {
    await api('/chinalife/presence.php', 'POST', {city,place,name:state.name,color:state.color,skin:state.appearance?.skin || '#8b5c43',hair:state.appearance?.hair || 'cropped',x:position?.x || 0,z:position?.z || 0});
    const result = await api('/chinalife/presence.php', 'GET', {city});
    if (generation !== epoch || !presence || game.state.city !== city || game.state.place !== place) return false;
    const data = result.data || result, ownId = data.id ?? account.user_id ?? account.id;
    presenceCheck={lastSuccess:new Date().toISOString(),error:null,serverId:String(ownId)};
    players = (data.players || []).filter(p => !p.own && String(p.user_id ?? p.id) !== String(ownId)).map(p => ({...p,id:String(p.id),city:p.city || city,name:p.name || p.sim_name,x:Number(p.x) || 0,z:Number(p.z) || 0})); publish();
    return true;
  } catch (error) {if(generation===epoch){presenceCheck.error=error.message;status('Shared city: ' + error.message)} return false} finally {polling = false}
}
function join() {
  if(!account||!auto||!game.state.created)return Promise.resolve(false);
  if(joining?.epoch===epoch)return joining.task;
  // Already joined with a presence update in flight: that update is not a failed join.
  if(presence&&polling)return Promise.resolve(true);
  const generation=epoch,city=game.state.city,place=game.state.place;presence=true;
  const task=(async()=>{
    let ok=await refreshPresence();
    // Arrival or travel can change the room during the first presence request.
    if(!ok&&generation===epoch&&presence&&(city!==game.state.city||place!==game.state.place))ok=await refreshPresence();
    if(generation!==epoch)return false;
    if(!ok){presence=false;players=[];publish()}
    return ok;
  })();
  joining={epoch:generation,task};
  task.finally(()=>{if(joining?.task===task)joining=null});
  return task;
}
async function leave() {epoch++; presence = false; players = []; publish(); if (account) try {await api('/chinalife/presence.php', 'DELETE', {})} catch {}}
async function initialize() {
  if (window.HafrikSession?.token) return connect(window.HafrikSession,{source:'app'});
  if (window.ReactNativeWebView) {loading=false;sessionSource='app';status('Connecting your Hafrik app account…');requestAppSession();notify();return false}
  if (liveToken) {
    if(await connect())return true;
    // Only an expired token permits falling back to website authentication.
    if(liveToken)return false;
  }
  // Cookie sessions work when the API supports existing Hafrik browser authentication.
  if (storage.getItem(PROFILE_KEY)) {if(await connect())return true;if(account)return false;}
  if (window.ReactNativeWebView) {status('Connecting your Hafrik app session…'); window.ReactNativeWebView.postMessage(JSON.stringify({type:'chinalife:auth-request'})); notify(); return false}
  // A Hafrik website session can exist without any ChinaLife device cache.
  // Ask the authenticated API before presenting optional login or character setup.
  const connected=await connect();
  if(!connected) game.startOnboarding();
  return connected;
}
window.ChinaLifeAuth = {base:HAFRIK_API,get token(){return liveToken},request:api,connect};
window.ChinaLifeCloud = {open:show,ready:null,get playerId(){return String(account?.user_id ?? account?.id ?? '')},get signedIn(){return !!account},get joined(){return presence},get players(){return players.filter(p => p.city === game.state.city && p.place === game.state.place)},get cityPlayers(){return players.filter(p => p.city === game.state.city)},refresh:refreshPresence,join,leave,upload,transfer,syncTransfers};
$('cloudButton').onclick = show; $('closeCloud').onclick = () => $('cloudDialog').close();
window.addEventListener('chinalife:save', () => {if (auto && !loading) scheduleSave()});
window.addEventListener('chinalife:update', () => {if (!loading && account && game.state.created) {if (!presence) join(); else refreshPresence()}});
window.addEventListener('hafrik:session', event => {if (event.detail?.token) connect(event.detail,{source:'app'})});
document.addEventListener('visibilitychange', () => {if (!document.hidden && account && game.state.created) {if (presence) refreshPresence(); else join()}});
// A failed first join must not disable all later heartbeats.
async function presenceHeartbeat() {
  if (loading || !auto || !account || !game.state.created || document.hidden) return false;
  return presence ? refreshPresence() : join();
}
setInterval(presenceHeartbeat, 2500);
setInterval(syncTransfers,5000);
window.ChinaLifeCloud.ready = initialize();
await window.ChinaLifeCloud.ready;
