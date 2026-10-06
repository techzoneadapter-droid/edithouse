import { NextResponse } from 'next/server';
import { runRole } from '@/lib/ai/provider';
import { splitDataUrl } from '@/lib/image-data';
import { failure, localRequest } from '@/lib/ai/http';
import sharp from 'sharp';
import { sampleSwatchColor, type SwatchBox } from '@/lib/catalog/color-sampler';
import { AIError } from '@/lib/ai/experiential-provider';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    localRequest(request); const {imageDataUrl} = await request.json();const {data}=splitDataUrl(imageDataUrl);
    const decoded=await sharp(Buffer.from(data,'base64'),{limitInputPixels:40000000}).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const pixels={data:decoded.data,width:decoded.info.width,height:decoded.info.height};
    const schema = {type:'object',additionalProperties:false,properties:{brand:{type:'string'},collection:{type:'string'},pageTitle:{type:'string'},swatches:{type:'array',maxItems:1000,items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},code:{type:'string'},confidence:{type:'number',minimum:0,maximum:1},box:{type:'array',minItems:4,maxItems:4,items:{type:'number',minimum:0,maximum:1000}}},required:['name','code','confidence','box']}}},required:['brand','collection','pageTitle','swatches']};
    const response = await runRole('CATALOG_OCR',async(ai,m)=>{
      const result = await ai.chat(m.slug,`Bạn đọc ảnh bảng màu sơn (${pixels.width}×${pixels.height} pixel). Chỉ chép chính xác chữ in: hãng, collection, tiêu đề trang, code và name. KHÔNG tạo, sửa format hoặc thêm prefix mã. Giữ nguyên chữ, số, dấu /, dấu -, khoảng trắng trong mã (ví dụ 30YY 83/029). Không thấy tên thì name rỗng; không đọc được mã thì code rỗng và confidence thấp. Không chắc hãng thì brand rỗng; không tự đặt hãng. Chuẩn hóa cách viết tên hãng rõ ràng như JOTUN thành Jotun, DULUX thành Dulux. box là [left,top,width,height], KHÔNG phải [left,top,right,bottom]. Chia left và width pixel cho ${pixels.width}, top và height pixel cho ${pixels.height}, rồi nhân 1000. x+width<=1000 và y+height<=1000. Box phải nằm BÊN TRONG đúng ô màu có pigment; không chứa tên, mã, nền giấy hay vùng nhãn. Kiểm tra box riêng cho từng swatch, nhất là trang ít ô màu. Không trả RGB/HEX; phần mềm sẽ đọc pixel. Không suy diễn màu sắc từ tên. Trả JSON đúng schema.`,[imageDataUrl],schema);
      if(result.choices?.[0]?.finish_reason==='length')throw new Error('Ảnh có quá nhiều ô màu; hãy chia thành nhiều ảnh nhỏ rồi nhập lại.');
      const parsed=JSON.parse(result.choices[0].message.content);
      if(!Array.isArray(parsed.swatches))throw new AIError('OCR không trả danh sách swatch hợp lệ.',502,'malformed_ocr_output');
      if(parsed.swatches.some((s:any)=>!Array.isArray(s.box)||s.box.length!==4||s.box.some((v:any)=>typeof v!=='number'||!Number.isFinite(v)||v<0)||s.box[2]<=0||s.box[3]<=0||s.box[0]+s.box[2]>1000.5||s.box[1]+s.box[3]>1000.5))throw new AIError('Model OCR trả tọa độ ô màu không hợp lệ.',502,'ocr_geometry_error');
      return parsed;
    });
    const parsed=response.result;
    if(!Array.isArray(parsed.swatches))throw new Error('OCR không trả danh sách swatch hợp lệ.');
    const swatches=parsed.swatches.slice(0,1000).map((swatch:any)=>{
      const base={code:typeof swatch.code==='string'?swatch.code:'',name:typeof swatch.name==='string'?swatch.name:'',box:swatch.box as SwatchBox,confidence:Math.max(0,Math.min(1,Number(swatch.confidence)||0))};
      try{return {...base,...sampleSwatchColor(pixels,base.box),samplingError:null};}
      catch(e){return {...base,hex:'',rgb:null,samplingError:e instanceof Error?e.message:'Không lấy được pixel.'};}
    });
    return NextResponse.json({brand:typeof parsed.brand==='string'?parsed.brand:'',collection:typeof parsed.collection==='string'?parsed.collection:'',pageTitle:typeof parsed.pageTitle==='string'?parsed.pageTitle:'',swatches,model:response.model});
  }catch(e){return failure(e);}
}
