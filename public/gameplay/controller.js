// Pure, fixed-step kinematic movement. Shared by client and future room authority.
export const CONTROLLER_VERSION=1;
export const STEP=1/60;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function characterState(x=0,z=0){return {x,y:0,z,vy:0,facing:0,grounded:true,animation:'idle',seat:null,jumpHeld:false}}
function overlaps(x,z,r,b){const dx=x-clamp(x,b.x-b.w/2,b.x+b.w/2),dz=z-clamp(z,b.z-b.d/2,b.z+b.d/2);return dx*dx+dz*dz<r*r-1e-8}
export function stepCharacter(previous,input={},room={bounds:{x:6,z:4},colliders:[]},dt=STEP){
 if(!Number.isFinite(dt)||dt<=0||dt>STEP*1.01)throw Error('Use fixed simulation steps');
 const s={...previous},radius=.25,height=1.7,boxes=room.colliders||[],bounds=room.bounds;
 let ix=Number.isFinite(input.x)?clamp(input.x,-1,1):0,iz=Number.isFinite(input.z)?clamp(input.z,-1,1):0;
 const length=Math.hypot(ix,iz);if(length>1){ix/=length;iz/=length}
 if(s.seat){s.animation='sit';s.jumpHeld=!!input.jump;return s}
 const jump=!!input.jump&&!s.jumpHeld&&s.grounded;s.jumpHeld=!!input.jump;
 if(jump){s.vy=5;s.grounded=false}
 const speed=input.run?5.8:3.8,dx=ix*speed*dt,dz=iz*speed*dt;
 const blocked=(x,z)=>boxes.some(b=>s.y<(b.top??1)&&s.y+height>(b.bottom??0)&&overlaps(x,z,radius,b));
 const x=clamp(s.x+dx,-bounds.x+radius,bounds.x-radius);if(!blocked(x,s.z))s.x=x;
 const z=clamp(s.z+dz,-bounds.z+radius,bounds.z-radius);if(!blocked(s.x,z))s.z=z;
 if(length>.01)s.facing=Math.atan2(ix,iz);
 const oldY=s.y;s.vy-=12*dt;s.y+=s.vy*dt;let floor=0;
 if(s.vy<=0)for(const b of boxes){const top=b.top??1;if(oldY>=top&&s.y<=top&&overlaps(s.x,s.z,radius,b))floor=Math.max(floor,top)}
 if(s.y<=floor){s.y=floor;s.vy=0;s.grounded=true}else s.grounded=false;
 s.animation=!s.grounded?'jump':length>.01?(input.run?'run':'walk'):['dance','wave'].includes(input.emote)?input.emote:'idle';return s;
}
// The server owns the seat lease; this function only applies an authorized pose.
export function sitCharacter(s,seat){if(!s.grounded||Math.hypot(s.x-seat.x,s.z-seat.z)>1)throw Error('Walk to this seat first');return {...s,x:seat.x,z:seat.z,y:seat.y??0,vy:0,facing:seat.facing??0,seat:seat.id,animation:'sit',jumpHeld:false}}
export function standCharacter(s,exit,room){const candidate=characterState(exit.x,exit.z);if(Math.abs(exit.x)>room.bounds.x-.25||Math.abs(exit.z)>room.bounds.z-.25||room.colliders.some(b=>overlaps(exit.x,exit.z,.25,b)))throw Error('Seat exit is blocked');return candidate}
