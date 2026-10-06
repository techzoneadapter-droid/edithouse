const sharp=require('sharp');
const fs=require('node:fs/promises');
const path=require('node:path');
async function main(){
  const directory=path.join(process.cwd(),'artifacts','catalog-verification');await fs.mkdir(directory,{recursive:true});
  const pages=[
    {file:'jotun-page1.png',brand:'JOTUN',collection:'Majestic',swatches:[['9918','Classic White','#E7E5DC'],['1024','Timeless','#D3C9B9'],['1622','Reflection','#A4B6C8']]},
    {file:'jotun-page2.png',brand:'JOTUN',collection:'Majestic',swatches:[['9918','Classic White','#E7E5DC'],['12075','','#BCA99C']]},
    {file:'dulux-page1.png',brand:'DULUX',collection:'Ambiance',swatches:[['30YY 83/029','Natural White','#E2DCD1'],['A-02 / B','','#5286AC']]}
  ];
  for(const page of pages){
    const content=page.swatches.map(([code,name,hex],i)=>`<rect x="${80+i*380}" y="220" width="280" height="280" fill="${hex}" stroke="#333" stroke-width="3"/><text x="${80+i*380}" y="565" font-size="32" fill="#111">${code}</text><text x="${80+i*380}" y="615" font-size="25" fill="#111">${name}</text>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="760"><rect width="1240" height="760" fill="#fff"/><g font-family="Arial"><text x="80" y="90" font-size="58" font-weight="bold">${page.brand}</text><text x="80" y="155" font-size="34">${page.collection}</text>${content}<text x="80" y="720" font-size="18">EditHouse test fixture — synthetic color card, not a commercial catalogue</text></g></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(directory,page.file));
  }
  const house='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#dce8ed"/><rect y="680" width="1200" height="120" fill="#777"/><rect x="240" y="200" width="720" height="480" fill="#c9bea9" stroke="#333" stroke-width="4"/><path d="M200 200 L600 45 L1000 200 Z" fill="#774f42"/><rect x="330" y="310" width="150" height="180" fill="#39566c" stroke="#eee" stroke-width="18"/><rect x="720" y="310" width="150" height="180" fill="#39566c" stroke="#eee" stroke-width="18"/><rect x="550" y="420" width="130" height="260" fill="#624936"/><rect x="240" y="600" width="310" height="35" fill="#ece3d4"/><rect x="680" y="600" width="280" height="35" fill="#ece3d4"/></svg>';
  await sharp(Buffer.from(house)).png().toFile(path.join(directory,'house.png'));
  console.log('Generated 3 synthetic color cards and a house fixture for browser tests.');
}
main().catch(e=>{console.error(e.message);process.exit(1);});
