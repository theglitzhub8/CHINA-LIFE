import sharp from 'sharp';import fs from 'fs';const T='/tmp/r7a/tex/',O='/workspace/cl/public/r7/tex/';fs.mkdirSync(O,{recursive:true});
const map={asphalt:'Asphalt025C',paving:'PavingStones130',brick:'Bricks076C',concrete:'Concrete034'};
for(const [k,n] of Object.entries(map)){const p=T+n+'/'+n+'_1K-JPG_';
await sharp(p+'Color.jpg').resize(512,512).webp({quality:78}).toFile(O+k+'_c.webp');
await sharp(p+'NormalGL.jpg').resize(512,512).webp({quality:82}).toFile(O+k+'_n.webp');
const r=await sharp(p+'Roughness.jpg').resize(256,256).greyscale().raw().toBuffer();const ao=fs.existsSync(p+'AmbientOcclusion.jpg')?await sharp(p+'AmbientOcclusion.jpg').resize(256,256).greyscale().raw().toBuffer():Buffer.alloc(256*256,255);
const b=Buffer.alloc(256*256*3);for(let i=0;i<256*256;i++){b[i*3]=ao[i];b[i*3+1]=r[i];b[i*3+2]=0}await sharp(b,{raw:{width:256,height:256,channels:3}}).webp({quality:80}).toFile(O+k+'_orm.webp')}
