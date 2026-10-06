import { NextResponse } from 'next/server';
import { runRole } from '@/lib/ai/provider';
import { splitDataUrl } from '@/lib/image-data';
import { validatePolygons } from '@/lib/masks';
import { failure, localRequest } from '@/lib/ai/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const {imageDataUrl,surface} = await request.json();splitDataUrl(imageDataUrl);
    const schema = {type:'object',properties:{polygons:{type:'array',items:{type:'array',minItems:3,items:{type:'array',minItems:2,maxItems:2,items:{type:'number',minimum:0,maximum:1000}}}}},required:['polygons'],additionalProperties:false};
    const response = await runRole('MASK_ANALYZE',async(ai,m)=> {
      const result = await ai.chat(m.slug,`Tìm polygon vùng bề mặt ${String(surface || 'tường')}. Tọa độ chuẩn hóa 0..1000. Loại trừ vật che, cửa, kính. Đường biên lỗ riêng theo even-odd. Không dùng bounding box thay mask; không chắc chắn thì polygons rỗng.`,[imageDataUrl],schema);
      return validatePolygons(JSON.parse(result.choices[0].message.content).polygons);
    });return NextResponse.json({polygons:response.result,model:response.model});
  }catch(e){return failure(e);}
}
