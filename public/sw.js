// Network first so every deploy is picked up immediately; the cache only keeps the game opening offline.
const CACHE='chinalife-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','index.html','manifest.webmanifest','icons/icon-192.png'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Only same-origin game files; Hafrik API calls and accounts are never cached.
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match('index.html'))));
});
// Daily reminder pushed by the server (no body): show it, and open the game when tapped.
self.addEventListener('push',event=>{event.waitUntil(self.registration.showNotification('ChinaLife',{body:'🎁 Your daily reward is ready. Come back and keep your streak!',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'daily-reward'}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const open=list.find(c=>'focus' in c);return open?open.focus():self.clients.openWindow('./')}))});
