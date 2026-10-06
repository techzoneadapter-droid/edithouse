import { NextResponse } from 'next/server';
import { runRole } from '@/lib/ai/provider';
import { splitDataUrl } from '@/lib/image-data';
import { failure, localRequest } from '@/lib/ai/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const {imageDataUrl} = await request.json();splitDataUrl(imageDataUrl);
    const schema = {type:'object',additionalProperties:false,properties:{brand:{type:'string'},collection:{type:'string'},swatches:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},code:{type:'string'},hex:{type:'string'},box:{type:'array',minItems:4,maxItems:4,items:{type:'number',minimum:0,maximum:1000}}},required:['name','code','hex','box']}}},required:['brand','collection','swatches']};
    const response = await runRole('CATALOG_OCR',async(ai,m)=>{
      const result = await ai.chat(m.slug,'Đọc bảng màu. Trả hãng, collection, tên và mã màu đúng như ảnh, HEX ước tính từ swatch, box [x,y,width,height] chuẩn hóa 0..1000. Không bịa mã màu; thông tin không đọc được trả chuỗi rỗng. HEX chỉ là ước tính, không phải màu thương mại chuẩn.',[imageDataUrl],schema);
      return JSON.parse(result.choices[0].message.content);
    });return NextResponse.json({...response.result,model:response.model});
  }catch(e){return failure(e);}
}
