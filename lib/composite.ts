import sharp from 'sharp';
import { splitDataUrl } from './image-data';

export async function compositeMasked(original: Buffer, generated: Buffer, masks: string[]) {
  const source = await sharp(original,{limitInputPixels:25000000}).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height} = source.info;
  const edited = await sharp(generated,{limitInputPixels:25000000}).resize(width,height,{fit:'fill'}).toColourspace('srgb').ensureAlpha().raw().toBuffer();
  const union = new Uint8Array(width*height);
  for (const mask of masks) {
    const {data,mimeType} = splitDataUrl(mask);
    if (mimeType !== 'image/png') throw new Error('Mask phải là PNG.');
    const decoded = await sharp(Buffer.from(data,'base64'),{limitInputPixels:25000000}).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if (decoded.info.width !== width || decoded.info.height !== height) throw new Error('Kích thước mask phải trùng ảnh gốc.');
    let nonempty = false;
    for (let i=0;i<union.length;i++) { const alpha=decoded.data[i*4+3]; union[i]=Math.max(union[i],alpha); if(alpha) nonempty=true; }
    if (!nonempty) throw new Error('Mask trống.');
  }
  for (let i=0;i<union.length;i++) {
    const a=union[i]/255;
    for(let c=0;c<3;c++) source.data[i*4+c]=Math.round(source.data[i*4+c]*(1-a)+edited[i*4+c]*a);
  }
  return sharp(source.data,{raw:{width,height,channels:4}}).png().toBuffer();
}
