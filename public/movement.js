// Recover saved or initial positions covered by furniture without moving valid entries.
export function safeRoomEntry(entry,obstacles,bounds){
 const valid=Math.abs(entry.x)<=bounds.x&&Math.abs(entry.z)<=bounds.z&&!obstacles.some(o=>Math.abs(entry.x-o.x)<o.w/2+.08&&Math.abs(entry.z-o.z)<o.d/2+.08);
 return valid?entry:(walkingPath(entry,entry,obstacles,bounds)[0]||{x:0,z:0});
}
// Walking uses a half-metre navigation grid with clearance around furniture.
export function walkingPath(start,end,obstacles,bounds={x:6,z:4},step=.4){
 const cols=Math.floor(bounds.x*2/step)+1,rows=Math.floor(bounds.z*2/step)+1;
 const point=(x,z)=>({x:-bounds.x+x*step,z:-bounds.z+z*step});
 const blocked=(x,z)=>obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.08&&Math.abs(z-o.z)<o.d/2+.08);
 const nearest=p=>{let best,score=Infinity;for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){const q=point(x,z),d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<score&&!blocked(q.x,q.z)){best={x,z};score=d}}return best};
 const a=nearest(start),b=nearest(end);if(!a||!b)return [];const key=p=>p.z*cols+p.x,queue=[a],prev=new Map([[key(a),null]]);let found=false;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(b)){found=true;break}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,z:p.z+dz};if(q.x<0||q.z<0||q.x>=cols||q.z>=rows||prev.has(key(q)))continue;const v=point(q.x,q.z);if(blocked(v.x,v.z))continue;prev.set(key(q),p);queue.push(q)}}
 if(!found)return [];let p=b,path=[];while(p){path.push(point(p.x,p.z));p=prev.get(key(p))}path.reverse();
 // Keep turns, so frames follow short straight sections instead of every cell.
 return path.filter((p,i)=>i===0||i===path.length-1||((path[i+1].x-p.x)!==(p.x-path[i-1].x))||((path[i+1].z-p.z)!==(p.z-path[i-1].z)));
}
export function activityMotion(place,index=0){if(place.startsWith('home-'))place='home';const campusIds=['medical','aerospace','technology','normal','ligong','jianzhu','agricultural','pharmaceutical','chemical','tcm','medical-college','engineering'];if(campusIds.includes(place))place='campus';if(['youle','ex','rex','orangutan','taxi-club','best-one','cats-eye','silver-knight'].includes(place))place='night';if(['black-sheep','tank'].includes(place))place='african';const defs={home:[['sleep',-3,1],['cook',4,-2.4]],ef:[['study',-1,2],['talk',0,3]],cafe:[['serve',0,-1.8],['type',2,3.2]],market:[['eat',0,0],['talk',0,0]],campus:[['study',-1,2],['talk',0,3]],gym:[['exercise',3,2],['basketball',1,2]],business:[['talk',0,3.3],['talk',0,-.5]],mall:[['sit',0,3],['browse',4,1]],park:[['walk',-4,2],['exercise',-3,2]],night:[['perform',0,-1.9],['talk',3,2],['dance',0,0]],blood:[['dance',0,0],['talk',3,2],['sit',-3.5,2],['perform',0,-1.9]],skylight:[['talk',3,2],['sit',2,3],['dance',0,0]],palace:[['walk',-2,2],['phone',2,3],['talk',0,3]],zhongjie:[['eat',-2,2],['browse',3,1],['sit',0,3]],hotel:[['sit',-3.4,2.4],['eat',-.2,1.4],['exercise',3.6,3.4],['sit',-1.6,2.6],['talk',2.6,-2.2]],academy:[['type',-1,2],['study',1,2],['cook',2,3],['type',-2,3],['talk',0,3],['talk',-3,2]],station:[['phone',0,2]],african:[['eat',2,3.2],['talk',-3,3.2]],church:[['pray',0,1],['talk',0,3]],plaza:[['sit',-4,2]],airport:[['sit',-1,3]]};const [kind,x,z]=(defs[place]||[['talk',0,2]])[index]||['talk',0,2];return {kind,x,z}}
