export type PaintBrand = {id:string;name:string;normalizedName:string;createdAt:string;updatedAt:string};
export type PaintCollection = {id:string;brandId:string;name:string;createdAt:string;sourceImages:string[]};
export type SourceImage = {id:string;name:string;dataUrl:string;createdAt:string;pageTitle:string};
export type CatalogColor = {
  id:string;brandId:string;collectionId:string;code:string;name:string;hex:string;rgb:[number,number,number];
  sourceImageId:string;sourceBox:[number,number,number,number];confidence:number;
};
export type CatalogSnapshot = {brands:PaintBrand[];collections:PaintCollection[];colors:CatalogColor[];sourceImages:SourceImage[]};
export type PreviewColor = Omit<CatalogColor,'id'|'brandId'|'collectionId'> & {id:string;brand:string;collection:string;selected:boolean;samplingError?:string};
export const emptyCatalog = ():CatalogSnapshot=>({brands:[],collections:[],colors:[],sourceImages:[]});
export function normalizeBrand(name:string) {return name.trim().normalize('NFKC').toLocaleLowerCase('vi');}
export function deduplicatePreview(colors:PreviewColor[]) {
  const unique=new Map<string,PreviewColor>();
  for(const color of colors) {
    const identity=!color.brand.trim()||!color.code.trim()?color.id:JSON.stringify([normalizeBrand(color.brand),color.collection.trim().normalize('NFKC').toLowerCase(),color.code]);
    const previous=unique.get(identity);
    if(!previous||color.confidence>previous.confidence)unique.set(identity,color);
  }
  return [...unique.values()];
}
