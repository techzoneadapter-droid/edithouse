export async function readCatalogImage(file:File):Promise<string>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
  if(file.size>25*1024*1024)throw new Error('Ảnh bảng màu tối đa 25 MB.');
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  try{
    const scale=Math.min(1,4096/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Không đọc được ảnh trong trình duyệt.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/png');if(data.length>35000000)throw new Error('Ảnh quá lớn; hãy chia bảng màu thành nhiều trang.');return data;
  }finally{bitmap.close();}
}
