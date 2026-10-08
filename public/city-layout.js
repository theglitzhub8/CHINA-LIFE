import {GRID,BASE_POSITIONS,cityMap} from './map-data.js';
// Fictional neighbourhoods, with a connected street network in every city. All city specifics live in map-data.js.
export function cityLayout(name,content){
 const map=cityMap(name),{north,coastal}=map,positions={...BASE_POSITIONS};
 // Each city's own places (Shenyang content, Guangzhou landmarks) bring their map positions.
 if(content)for(const venues of Object.values(content))if(Array.isArray(venues))for(const venue of venues)if(venue.position)positions[venue.id]=venue.position;
 // Per-city overrides, e.g. Shenyang's hotel stands behind Hafrik Square so it never hides it.
 Object.assign(positions,map.positions);
 const {xs,zs}=GRID,districts=map.districts;
 const entries=Object.fromEntries(Object.entries(positions).map(([id,[x,z]])=>{const roadX=xs.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a),roadZ=zs.reduce((a,b)=>Math.abs(b-z)<Math.abs(a-z)?b:a);return [id,Math.abs(roadX-x)<Math.abs(roadZ-z)?{x:roadX,z}:{x,z:roadZ}]}));
 // Hafrik HQ sits north of the grid; its entrance is at the front of its avenue, not inside the towers.
 if(positions.hq)entries.hq={x:positions.hq[0],z:positions.hq[1]+13};
 return {name,north,coastal,positions,entries,xs,zs,districts,width:GRID.width,depth:GRID.depth,riverZ:GRID.riverZ,welcome:map.welcome,prototype:map.prototype};
}
export function streetRoute(layout,from,to){const a=layout.entries[from],b=layout.entries[to];if(!a||!b)return [];const nodes=[];for(const x of layout.xs)for(const z of layout.zs)nodes.push({x,z});nodes.push(a,b);const ai=nodes.length-2,bi=nodes.length-1,distance=nodes.map(()=>Infinity),prev=[],pending=new Set(nodes.map((_,i)=>i));distance[ai]=0;while(pending.size){const i=[...pending].reduce((a,b)=>distance[a]<distance[b]?a:b);pending.delete(i);if(i===bi||!Number.isFinite(distance[i]))break;for(const j of pending){const p=nodes[i],q=nodes[j];if(p.x!==q.x&&p.z!==q.z)continue;const cost=Math.abs(p.x-q.x)+Math.abs(p.z-q.z);if(distance[i]+cost<distance[j]){distance[j]=distance[i]+cost;prev[j]=i}}}if(!Number.isFinite(distance[bi]))return [];let route=[],i=bi;while(i!==undefined){route.push(nodes[i]);i=prev[i]}return route.reverse()}
