const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
async function main(){
  for(const [file,codes] of [['jotun-page1.png',['9918','1024','1622']],['jotun-page2.png',['9918','12075']],['dulux-page1.png',['30YY 83/029','A-02 / B']]]){
    const bytes=await fs.readFile(`artifacts/catalog-verification/${file}`);
    const response=await fetch('http://localhost:3000/api/catalog/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:'data:image/png;base64,'+bytes.toString('base64')}),signal:AbortSignal.timeout(180000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    await fs.writeFile(`artifacts/catalog-verification/${file}.json`,JSON.stringify(result,null,2));
    console.log(file,result.brand,result.model,result.swatches.map(c=>({code:c.code,hex:c.hex,confidence:c.confidence,error:c.samplingError})));
    for(const code of codes)assert.ok(result.swatches.some(c=>c.code===code),`OCR must retain exact code ${code}`);
    assert.ok(result.swatches.every(c=>!c.samplingError));
    if(file==='jotun-page1.png')assert.equal(result.swatches.find(c=>c.code==='9918').hex,'#E7E5DC');
  }
  console.log('Real gateway OCR + pixel sampling PASS');
}
main().catch(e=>{console.error(e.message);process.exit(1);});
