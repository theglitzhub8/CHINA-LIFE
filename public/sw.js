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
