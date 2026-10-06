export type RGB = [number,number,number];
export type PixelImage = {width:number;height:number;data:Uint8Array|Uint8ClampedArray};
export type SwatchBox = [number,number,number,number];
export function rgbToHex(rgb:RGB) {return '#'+rgb.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
function median(values:number[]) {const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
export function medianColor(colors:RGB[]):RGB {if(!colors.length)throw new Error('Không có pixel màu hợp lệ.');return [0,1,2].map(channel=>Math.round(median(colors.map(c=>c[channel])))) as RGB;}
const distance=(a:RGB,b:RGB)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function removeOutliers(colors:RGB[]) {
  if(!colors.length)return [];
  const pigment=colors.filter(c=>!(c.every(v=>v>=248)||c.every(v=>v<=12)));
  // Reject paper/lettering only when a substantial color region exists; keep genuine white/black cards.
  const candidates=pigment.length>=colors.length*.2?pigment:colors;
  // Choose the dominant cluster before rejecting text: real white/black swatches must remain valid.
  const bins=new Map<string,RGB[]>();
  for(const color of candidates){const bin=color.map(v=>Math.floor(v/24)).join(':');const bucket=bins.get(bin)||[];bucket.push(color);bins.set(bin,bucket);}
  const dominant=[...bins.values()].sort((a,b)=>b.length-a.length)[0];
  const center=medianColor(dominant);
  const deviations=dominant.map(c=>distance(c,center));
  const threshold=Math.max(32,median(deviations)*3);
  return candidates.filter(c=>distance(c,center)<=threshold);
}
export function sampleSwatchColor(image:PixelImage,box:SwatchBox) {
  if(!Array.isArray(box)||box.length!==4||box.some(v=>!Number.isFinite(v))||box[0]<0||box[1]<0||box[2]<=0||box[3]<=0||box[0]+box[2]>1000.5||box[1]+box[3]>1000.5)throw new Error('Bounding box swatch không hợp lệ. Sửa lại ảnh hoặc bỏ chọn ô màu.');
  if(image.data.length!==image.width*image.height*4)throw new Error('Dữ liệu pixel không hợp lệ.');
  const x0=Math.floor(box[0]*image.width/1000), y0=Math.floor(box[1]*image.height/1000);
  const width=Math.floor(box[2]*image.width/1000),height=Math.floor(box[3]*image.height/1000);
  if(width<5||height<5)throw new Error('Ô màu quá nhỏ để lấy pixel đáng tin cậy.');
  const inset=.14,patch=.23;
  const patches=[[inset,inset],[1-inset-patch,inset],[inset,1-inset-patch],[1-inset-patch,1-inset-patch],[.5-patch/2,.5-patch/2]];
  const colors:RGB[]=[];
  for(const [px,py] of patches){
    const left=x0+Math.floor(px*width),top=y0+Math.floor(py*height);
    const pw=Math.max(1,Math.floor(patch*width)),ph=Math.max(1,Math.floor(patch*height));
    const stride=Math.max(1,Math.floor(Math.sqrt(pw*ph/400)));
    for(let y=top;y<Math.min(image.height,top+ph);y+=stride)for(let x=left;x<Math.min(image.width,left+pw);x+=stride){const i=(y*image.width+x)*4;if(image.data[i+3]<240)continue;colors.push([image.data[i],image.data[i+1],image.data[i+2]]);}
  }
  const clean=removeOutliers(colors);if(clean.length<15)throw new Error('Không đủ pixel swatch để xác định màu.');
  const rgb=medianColor(clean);
  return {rgb,hex:rgbToHex(rgb),sampleCount:clean.length,dominantFraction:clean.length/colors.length};
}
