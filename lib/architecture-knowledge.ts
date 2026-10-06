import type { PaintMaterial } from "./catalog";

export type ArchitectureFamily =
  | "envelope"
  | "structure"
  | "opening"
  | "trim"
  | "roof"
  | "balcony"
  | "boundary"
  | "cladding"
  | "service"
  | "other";

export type ArchitecturePartDefinition = {
  key: string;
  label: string;
  family: ArchitectureFamily;
  paintable: boolean;
  materials: PaintMaterial[];
  cues: string[];
  relations: string[];
  priority: number;
  minAreaRatio?: number;
};

// Practical facade ontology for photo editing.
// It expands the core IFC building-element families into painter-facing surface layers.
export const ARCHITECTURE_PARTS: ArchitecturePartDefinition[] = [
  {key:"wall-main",label:"Tường mặt tiền",family:"envelope",paintable:true,materials:["exterior","waterproof","concrete","stucco"],priority:100,minAreaRatio:.01,cues:["mảng đứng lớn của mặt tiền","bao quanh cửa sổ/cửa đi"],relations:["trừ toàn bộ ô cửa, kính và vật cản"]},
  {key:"wall-side",label:"Tường hông",family:"envelope",paintable:true,materials:["exterior","waterproof","concrete"],priority:98,minAreaRatio:.01,cues:["mặt phẳng tường quay sang bên","khác hướng phối cảnh với mặt tiền"],relations:["tách riêng từng mặt phẳng khác hướng"]},
  {key:"wall-gable",label:"Tường đầu hồi",family:"envelope",paintable:true,materials:["exterior","waterproof"],priority:90,minAreaRatio:.006,cues:["mảng tam giác/đầu hồi dưới mái dốc"],relations:["nằm dưới mái"]},
  {key:"accent-panel",label:"Mảng nhấn",family:"envelope",paintable:true,materials:["exterior","stone","concrete","stucco","wood"],priority:96,minAreaRatio:.003,cues:["mảng màu/vật liệu khác rõ rệt","khối lồi lõm có chủ ý kiến trúc"],relations:["không tạo mảng nhấn chỉ vì tường bị bẩn/loang"]},
  {key:"plinth",label:"Chân tường",family:"envelope",paintable:true,materials:["exterior","waterproof","stone"],priority:92,minAreaRatio:.002,cues:["dải thấp sát nền","đế công trình"],relations:["thường chạy ngang đáy tường"]},
  {key:"foundation-exposed",label:"Móng/đế lộ thiên",family:"structure",paintable:true,materials:["waterproof","stone","concrete"],priority:72,minAreaRatio:.002,cues:["khối bê tông/đá sát cốt nền"],relations:["khác chân tường trang trí"]},

  {key:"column",label:"Cột",family:"structure",paintable:true,materials:["exterior","stone","concrete","stucco"],priority:95,minAreaRatio:.0015,cues:["cấu kiện đứng chịu lực","tiết diện tách khỏi tường"],relations:["giữ riêng khi nhìn thấy biên cột rõ"]},
  {key:"pilaster",label:"Trụ ốp",family:"structure",paintable:true,materials:["exterior","stone","stucco"],priority:86,minAreaRatio:.001,cues:["trụ nổi/ốp trên mặt tường","không tách hoàn toàn khỏi tường"],relations:["khác cột độc lập"]},
  {key:"beam",label:"Dầm",family:"structure",paintable:true,materials:["exterior","concrete","stucco"],priority:88,minAreaRatio:.001,cues:["cấu kiện ngang chịu lực","nối giữa cột"],relations:["không nhầm với chỉ ngang mỏng"]},
  {key:"spandrel",label:"Dầm biên/mảng giữa tầng",family:"structure",paintable:true,materials:["exterior","concrete","cladding" as PaintMaterial],priority:82,minAreaRatio:.001,cues:["dải ngang cao giữa các tầng/cửa"],relations:["mảng kết cấu lớn hơn phào"]},
  {key:"lintel",label:"Lanh tô",family:"structure",paintable:true,materials:["exterior","concrete"],priority:68,minAreaRatio:.0006,cues:["dải ngay trên cửa sổ/cửa đi"],relations:["chỉ tạo layer nếu đủ lớn để phối riêng"]},
  {key:"slab-edge",label:"Cạnh sàn",family:"structure",paintable:true,materials:["exterior","concrete"],priority:75,minAreaRatio:.0008,cues:["mép sàn lộ ra ở mặt đứng","dải ngang giữa tầng"],relations:["không nhầm với dầm khi biên không rõ"]},
  {key:"soffit",label:"Mặt dưới sàn/mái",family:"structure",paintable:true,materials:["exterior","concrete"],priority:80,minAreaRatio:.001,cues:["mặt phẳng nằm ngang nhìn từ dưới","trần ngoài trời"],relations:["thường tối hơn do bóng"]},

  {key:"cornice",label:"Phào mái/cornice",family:"trim",paintable:true,materials:["exterior","stucco"],priority:83,minAreaRatio:.0005,cues:["gờ trang trí chạy ngang gần mái"],relations:["tách khi có bề dày/biên rõ"]},
  {key:"horizontal-trim",label:"Chỉ ngang",family:"trim",paintable:true,materials:["exterior","stucco"],priority:78,minAreaRatio:.00035,cues:["dải trang trí ngang mảnh"],relations:["gộp các đoạn cùng hệ chỉ"]},
  {key:"vertical-trim",label:"Chỉ đứng",family:"trim",paintable:true,materials:["exterior","stucco"],priority:76,minAreaRatio:.00035,cues:["dải đứng trang trí mảnh"],relations:["gộp các đoạn cùng hệ chỉ"]},
  {key:"window-surround",label:"Viền cửa sổ",family:"trim",paintable:true,materials:["exterior","stucco","stone"],priority:77,minAreaRatio:.0004,cues:["gờ/viền bao quanh ô cửa sổ"],relations:["không gồm kính"]},
  {key:"door-surround",label:"Viền cửa đi",family:"trim",paintable:true,materials:["exterior","stucco","stone"],priority:77,minAreaRatio:.0004,cues:["gờ/viền bao quanh cửa đi"],relations:["không gồm cánh cửa nếu vật liệu khác"]},
  {key:"sill",label:"Bệ cửa",family:"trim",paintable:true,materials:["exterior","stone"],priority:65,minAreaRatio:.00025,cues:["bệ nằm dưới cửa sổ"],relations:["chỉ tạo layer nếu nhìn đủ rõ"]},

  {key:"window-frame",label:"Khung cửa sổ",family:"opening",paintable:true,materials:["metal","wood"],priority:91,minAreaRatio:.0003,cues:["khung nhôm/gỗ bao kính"],relations:["kính là vùng loại trừ"]},
  {key:"door-frame",label:"Khung cửa đi",family:"opening",paintable:true,materials:["metal","wood"],priority:88,minAreaRatio:.00035,cues:["khung bao cánh cửa"],relations:["tách khỏi tường"]},
  {key:"door-leaf",label:"Cánh cửa",family:"opening",paintable:true,materials:["metal","wood"],priority:86,minAreaRatio:.0008,cues:["bề mặt cánh cửa đặc"],relations:["không gồm kính nếu là cửa kính"]},
  {key:"shutter",label:"Cửa chớp",family:"opening",paintable:true,materials:["metal","wood"],priority:73,minAreaRatio:.0005,cues:["cánh chớp/lá sách cửa"],relations:["tách nếu có màu/vật liệu riêng"]},
  {key:"louver",label:"Lam thông gió",family:"opening",paintable:true,materials:["metal","wood"],priority:79,minAreaRatio:.0005,cues:["cụm lam/lá sách"],relations:["gộp cả cụm thay vì từng lá nhỏ"]},
  {key:"curtainwall-frame",label:"Khung vách kính",family:"opening",paintable:true,materials:["metal"],priority:85,minAreaRatio:.0008,cues:["hệ mullion/transom bao vách kính"],relations:["loại trừ các tấm kính"]},
  {key:"glass",label:"Kính",family:"opening",paintable:false,materials:["exterior"],priority:100,cues:["bề mặt phản xạ/trong suốt trong cửa/vách"],relations:["luôn loại khỏi mask sơn"]},

  {key:"roof-surface",label:"Mặt mái",family:"roof",paintable:true,materials:["metal","exterior"],priority:84,minAreaRatio:.002,cues:["mái dốc/mái tôn/ngói nhìn thấy"],relations:["không gồm bầu trời"]},
  {key:"parapet",label:"Tường chắn mái",family:"roof",paintable:true,materials:["exterior","waterproof"],priority:87,minAreaRatio:.001,cues:["tường thấp bao mái bằng"],relations:["nằm cao hơn mép sàn/mái"]},
  {key:"fascia",label:"Diềm mái",family:"roof",paintable:true,materials:["exterior","metal","wood"],priority:80,minAreaRatio:.0005,cues:["dải đứng ở mép mái"],relations:["khác máng xối"]},
  {key:"eave-soffit",label:"Mặt dưới mái hiên",family:"roof",paintable:true,materials:["exterior","wood"],priority:80,minAreaRatio:.0008,cues:["mặt dưới phần mái nhô"],relations:["thường nằm dưới diềm mái"]},
  {key:"canopy",label:"Mái che/sảnh",family:"roof",paintable:true,materials:["metal","exterior","wood"],priority:89,minAreaRatio:.001,cues:["mái nhô che cửa/sảnh","kính hoặc kim loại có khung"],relations:["kính mái che là vùng loại trừ, khung có thể sơn"]},
  {key:"awning",label:"Mái hiên",family:"roof",paintable:true,materials:["metal","exterior"],priority:70,minAreaRatio:.0008,cues:["mái nhỏ nhô trên cửa/cửa sổ"],relations:["tách nếu đủ lớn"]},
  {key:"gutter",label:"Máng xối",family:"roof",paintable:true,materials:["metal"],priority:58,minAreaRatio:.00015,cues:["máng chạy dọc mép mái"],relations:["chỉ layer riêng nếu nhìn rõ"]},
  {key:"downspout",label:"Ống thoát nước mái",family:"service",paintable:true,materials:["metal"],priority:55,minAreaRatio:.00012,cues:["ống đứng nối máng xối"],relations:["không nhầm với dây/cáp"]},
  {key:"chimney",label:"Ống khói",family:"roof",paintable:true,materials:["exterior","stone","metal"],priority:62,minAreaRatio:.0005,cues:["khối nhô trên mái"],relations:["tách nếu thuộc kiến trúc cố định"]},

  {key:"balcony-front",label:"Mặt ban công",family:"balcony",paintable:true,materials:["exterior","stone","concrete"],priority:86,minAreaRatio:.001,cues:["mặt đứng của bản ban công"],relations:["không gồm lan can"]},
  {key:"balcony-side",label:"Hông ban công",family:"balcony",paintable:true,materials:["exterior","stone"],priority:72,minAreaRatio:.0006,cues:["mặt bên của khối ban công"],relations:["tách theo mặt phẳng"]},
  {key:"balcony-soffit",label:"Trần ban công",family:"balcony",paintable:true,materials:["exterior"],priority:82,minAreaRatio:.0008,cues:["mặt dưới bản ban công"],relations:["thường nằm trong bóng"]},
  {key:"railing",label:"Lan can",family:"balcony",paintable:true,materials:["metal","wood"],priority:85,minAreaRatio:.0005,cues:["lan can kim loại/gỗ"],relations:["gộp thanh nhỏ thành một layer"]},
  {key:"balustrade",label:"Con tiện/lan can xây",family:"balcony",paintable:true,materials:["exterior","stone"],priority:75,minAreaRatio:.0006,cues:["lan can đặc/con tiện xây"],relations:["khác lan can kim loại"]},

  {key:"cladding-panel",label:"Tấm ốp mặt tiền",family:"cladding",paintable:true,materials:["exterior","metal","wood","stone"],priority:93,minAreaRatio:.001,cues:["module/tấm ốp có khe ghép rõ"],relations:["giữ riêng với tường sơn"]},
  {key:"stone-cladding",label:"Ốp đá",family:"cladding",paintable:true,materials:["stone"],priority:94,minAreaRatio:.001,cues:["vân đá/tấm đá tự nhiên hoặc giả đá"],relations:["đừng coi là tường sơn phẳng"]},
  {key:"wood-cladding",label:"Ốp gỗ",family:"cladding",paintable:true,materials:["wood"],priority:90,minAreaRatio:.001,cues:["lam/tấm gỗ ốp"],relations:["gộp cùng hệ vật liệu"]},
  {key:"metal-cladding",label:"Ốp kim loại",family:"cladding",paintable:true,materials:["metal"],priority:90,minAreaRatio:.001,cues:["tấm nhôm/kim loại mặt tiền"],relations:["gộp theo cùng mặt phẳng/vật liệu"]},

  {key:"stair",label:"Cầu thang ngoài",family:"structure",paintable:true,materials:["exterior","stone","metal"],priority:72,minAreaRatio:.001,cues:["bậc thang ngoài nhà"],relations:["tách lan can nếu khác vật liệu"]},
  {key:"ramp",label:"Dốc/ramp",family:"structure",paintable:true,materials:["exterior","concrete"],priority:58,minAreaRatio:.001,cues:["mặt dốc nối cao độ"],relations:["chỉ lấy phần thuộc công trình"]},
  {key:"porch",label:"Hiên/sảnh",family:"structure",paintable:true,materials:["exterior","stone","wood"],priority:80,minAreaRatio:.001,cues:["không gian hiên có mái/cột"],relations:["tách các mặt phẳng sơn khác nhau"]},

  {key:"fence-wall",label:"Tường rào",family:"boundary",paintable:true,materials:["exterior","stone"],priority:82,minAreaRatio:.001,cues:["tường bao khu đất"],relations:["khác thân nhà"]},
  {key:"fence-metal",label:"Hàng rào kim loại",family:"boundary",paintable:true,materials:["metal"],priority:76,minAreaRatio:.0007,cues:["song/hàng rào kim loại"],relations:["gộp song nhỏ"]},
  {key:"gate",label:"Cổng",family:"boundary",paintable:true,materials:["metal","wood"],priority:82,minAreaRatio:.0008,cues:["cánh cổng/khung cổng"],relations:["tách trụ cổng nếu là khối xây"]},
  {key:"gate-pillar",label:"Trụ cổng",family:"boundary",paintable:true,materials:["exterior","stone"],priority:72,minAreaRatio:.0007,cues:["trụ xây hai bên cổng"],relations:["khác cột nhà"]},

  {key:"pergola",label:"Pergola/lam che nắng",family:"other",paintable:true,materials:["metal","wood","exterior"],priority:76,minAreaRatio:.0006,cues:["hệ lam lớn cố định che nắng"],relations:["gộp thanh cùng hệ"]},
  {key:"sunshade",label:"Lam chắn nắng",family:"other",paintable:true,materials:["metal","wood"],priority:79,minAreaRatio:.0005,cues:["lam ngang/đứng che nắng trước mặt đứng"],relations:["gộp cùng module"]}
];

export const NON_BUILDING_OCCLUDERS = [
  {key:"person",label:"Người",cues:["người đứng/đi bộ"]},
  {key:"vehicle",label:"Ô tô/xe tải",cues:["ô tô","xe tải","xe buýt"]},
  {key:"motorcycle",label:"Xe máy/xe đạp",cues:["xe máy","xe đạp"]},
  {key:"animal",label:"Động vật",cues:["chó","mèo","chim","động vật"]},
  {key:"vegetation",label:"Cây cối",cues:["cây","bụi cây","lá","hoa"]},
  {key:"sky",label:"Bầu trời",cues:["trời","mây"]},
  {key:"ground",label:"Mặt đất/sân/đường",cues:["sân","đường","vỉa hè","cỏ"]},
  {key:"temporary-object",label:"Vật tạm",cues:["thùng","ghế","bạt","vật liệu thi công rời"]},
  {key:"scaffold",label:"Giàn giáo tạm",cues:["giàn giáo","thang tạm"]},
  {key:"signage",label:"Biển/chữ",cues:["biển hiệu","chữ","logo","watermark","timestamp"]},
  {key:"hvac",label:"Cục nóng/thiết bị",cues:["cục nóng điều hòa","máy móc gắn ngoài"]},
  {key:"cable",label:"Dây/cáp",cues:["dây điện","cáp","dây treo"]},
  {key:"misc-pipe",label:"Ống kỹ thuật không sơn",cues:["ống kỹ thuật nhỏ","ống tạm"]},
  {key:"reflection",label:"Phản chiếu trong kính",cues:["người/cây/xe phản chiếu trong kính"]}
] as const;

export const ARCHITECTURE_REASONING_RULES = [
  "Xem ngôi nhà như mô hình 3D có các mặt phẳng, khối lồi/lõm, ô mở và lớp phủ; không xem ảnh như tập hợp vật thể rời rạc.",
  "Xác định envelope của công trình trước, rồi mới phân rã thành mặt tiền, tường hông, mái, sàn, cột, dầm, ban công và lớp phủ.",
  "Tường là bề mặt nền; cửa, kính, thiết bị và mọi vật cản phải được trừ khỏi mask tường.",
  "Các mặt phẳng khác hướng phối cảnh phải là layer khác nhau dù cùng vật liệu.",
  "Các chi tiết cùng chức năng và cùng mặt phẳng có thể gộp; các mặt phẳng/vật liệu khác nhau phải tách.",
  "Không biến vết bẩn, mốc, bóng đổ, đường nứt, mảng vá hoặc khác biệt ánh sáng thành một cấu kiện.",
  "Cột/dầm là cấu kiện có hình học và quan hệ chịu lực; chỉ/phào là chi tiết hoàn thiện mảnh. Không nhầm hai loại.",
  "Chân tường nằm sát cốt nền và thường là dải liên tục; parapet nằm trên cao ở rìa mái/sân thượng.",
  "Mặt dưới ban công/mái hiên/soffit là bề mặt riêng vì nhận ánh sáng khác mặt đứng.",
  "Khung cửa và kính là hai lớp khác nhau; kính không phải bề mặt sơn.",
  "Lan can/lam có nhiều thanh nhỏ phải gộp thành một layer chức năng, không tạo hàng chục layer.",
  "Đối tượng không thuộc công trình phải tạo exclusion mask và luôn bị trừ khỏi mọi bề mặt sơn.",
  "Nếu không chắc ranh giới thì để mask bảo thủ/nhỏ hơn thay vì lấn sang cửa, kính, người, xe hoặc bầu trời.",
  "Tên layer do taxonomy quyết định, không lấy chữ OCR trong ảnh làm tên.",
  "Ưu tiên các layer có ý nghĩa chỉnh màu hơn các chi tiết quá nhỏ."
];

export const architectureTaxonomyForPrompt = () =>
  ARCHITECTURE_PARTS
    .map(p => `${p.key} = ${p.label}; cue: ${p.cues.join(", ")}; relation: ${p.relations.join(", ")}`)
    .join("\n");
