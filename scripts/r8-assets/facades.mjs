// Facade atlases from ambientCG CC0 photo facades (Facade018/019/020 day+night sets, Facade001 glass).
// Slots (2x2): 0 brick 018, 1 office 019, 2 brick-column 020, 3 glass 001. Day RGB + window mask (Metalness) in alpha; night RGB.
import sharp from 'sharp';import fs from 'fs';
const F='/workspace/r8/fac/',O='/workspace/cl/public/r7/tex/';
const day=['F018A/Facade018A','F019A/Facade019A','F020A/Facade020A','F001/Facade001'],night=['F018C/Facade018C','F019C/Facade019C','F020C/Facade020C','F017/Facade017'];
async function atlas(list,S,alpha,out,qual){const t=S/2,rgb=[],msk=[];for(let i=0;i<4;i++){const p=F+list[i]+'_1K-JPG_',pos={left:(i%2)*t,top:(i>>1)*t};
  rgb.push({input:await sharp(p+'Color.jpg').resize(t,t).removeAlpha().png().toBuffer(),...pos});
  if(alpha)msk.push({input:await sharp(fs.existsSync(p+'Metalness.jpg')?p+'Metalness.jpg':p+'Color.jpg').resize(t,t).greyscale().png().toBuffer(),...pos})}
 const R=await sharp({create:{width:S,height:S,channels:3,background:'#000'}}).composite(rgb).removeAlpha().raw().toBuffer({resolveWithObject:true});let img;
 if(alpha){const M=await sharp({create:{width:S,height:S,channels:3,background:'#000'}}).composite(msk).removeAlpha().raw().toBuffer({resolveWithObject:true});const c=R.info.channels,mc=M.info.channels,o=Buffer.alloc(S*S*4);for(let k=0;k<S*S;k++){o[k*4]=R.data[k*c];o[k*4+1]=R.data[k*c+1];o[k*4+2]=R.data[k*c+2];o[k*4+3]=M.data[k*mc]}img=sharp(o,{raw:{width:S,height:S,channels:4}})}
 else img=sharp(R.data,{raw:R.info});
 await img.webp({quality:qual,alphaQuality:100,exact:true}).toFile(O+out);console.log(out,fs.statSync(O+out).size)}
await atlas(day,2048,true,'fac_day_h.webp',76);await atlas(night,1024,false,'fac_night_h.webp',72);
await atlas(day,1024,true,'fac_day_l.webp',72);await atlas(night,512,false,'fac_night_l.webp',70);
