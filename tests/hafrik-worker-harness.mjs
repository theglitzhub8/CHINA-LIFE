import fs from 'node:fs';import vm from 'node:vm';
// Client contract adapter: existing Worker authorization tests remain useful while
// tests/php-api.mjs independently runs the production PHP implementation.
export async function connectClient(t,server,id,signedIn=true){
 const c=t.context,local=new Map();c.URLSearchParams=URLSearchParams;c.Date ||= Date;
 c.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)};
 if(signedIn){await server.call(id,'/api/save','PUT',{revision:0,state:JSON.parse(JSON.stringify(t.game.state))});c.HafrikSession={token:'test-'+id,user:{id,name:id}}}
 let latest=[],signals=[];
 c.fetch=async(raw,options)=>{
  const url=new URL(raw),name=url.pathname.split('/').at(-1).replace('.php',''),routes={save:'/api/save',presence:'/api/presence',messages:'/api/messages',social:'/api/social',friends:'/api/friends',block:'/api/block',report:'/api/report',voice:'/api/voice','voice-signal':'/api/voice/signal',music:'/api/music'};
  const method=options.method||'GET',input=options.body?JSON.parse(options.body):undefined;
  if(name==='voice-signal'&&method==='GET')return Response.json({status:'success',data:{signals}});
  if(name==='messages'){if(method==='GET')url.searchParams.set('channel',url.searchParams.has('peer')?'direct':'venue');else if(input)input.channel=input.peer?'direct':'venue';}
  if(name==='presence'&&method==='GET')return Response.json({status:'success',data:{players:latest}});
  let body=input;if(name==='save'&&method==='POST')body={state:input.save.game,revision:input.revision};
  const result=await server.call(signedIn?id:null,routes[name]+url.search,name==='save'&&method==='POST'?'PUT':method,body),data=await result.json();
  if(name==='voice'&&method==='POST')signals=data.signals||[];
  if(name==='presence'&&method==='POST')latest=(data.players||[]).map(p=>({...p,city:input.city,place:input.place}));
  const payload=name==='save'&&method==='GET'?{exists:!!data.state,save:data.state?{game:data.state}:null,revision:data.revision,account:{id,name:id}}:data;
  return Response.json({status:result.ok?'success':'error',message:data.error,data:payload},{status:result.status});
 };
 await vm.runInContext('(async()=>{'+fs.readFileSync('public/cloud.js','utf8')+'})()',c);
 if(signedIn)await c.ChinaLifeCloud.leave(); // social controls explicitly exercise joining
 return t;
}
