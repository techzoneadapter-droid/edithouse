/* EditHouse SAM2 browser worker.
 * Uses Meta SAM2 ONNX weights and ONNX Runtime Web.
 * Models are cached by the browser after the first download.
 */

const ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
const ENCODER_URL = "https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_encoder.with_runtime_opt.ort";
const DECODER_URL = "https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder_pr1.onnx";

importScripts(ORT_BASE + "ort.all.min.js");
ort.env.wasm.wasmPaths = ORT_BASE;
ort.env.wasm.numThreads = 1;

let encoderSession = null;
let decoderSession = null;
let encodedImage = null;
let device = "unknown";

async function modelBuffer(url) {
  try {
    if ("caches" in self) {
      const cache = await caches.open("edithouse-sam2-v1");
      let response = await cache.match(url);
      if (!response) {
        response = await fetch(url, { mode: "cors" });
        if (!response.ok) throw new Error("Không tải được model SAM2 (" + response.status + ").");
        await cache.put(url, response.clone());
      }
      return await response.arrayBuffer();
    }
  } catch (error) {
    console.warn("SAM2 cache fallback", error);
  }
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Không tải được model SAM2 (" + response.status + ").");
  return await response.arrayBuffer();
}

async function createSession(model) {
  let lastError = null;
  for (const provider of ["webgpu", "wasm"]) {
    try {
      const session = await ort.InferenceSession.create(model, { executionProviders: [provider] });
      return { session, provider };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Trình duyệt không chạy được SAM2.");
}

async function ensureReady() {
  if (encoderSession && decoderSession) return;
  const [encoder, decoder] = await Promise.all([modelBuffer(ENCODER_URL), modelBuffer(DECODER_URL)]);
  const encoderResult = await createSession(encoder);
  const decoderResult = await createSession(decoder);
  encoderSession = encoderResult.session;
  decoderSession = decoderResult.session;
  device = encoderResult.provider === decoderResult.provider
    ? encoderResult.provider
    : encoderResult.provider + "/" + decoderResult.provider;
}

async function encode(float32Array, shape) {
  await ensureReady();
  const input = new ort.Tensor("float32", float32Array, shape);
  const results = await encoderSession.run({ image: input });
  encodedImage = {
    high_res_feats_0: results[encoderSession.outputNames[0]],
    high_res_feats_1: results[encoderSession.outputNames[1]],
    image_embed: results[encoderSession.outputNames[2]]
  };
}

async function decode(points, previousMask, previousMaskShape) {
  await ensureReady();
  if (!encodedImage) throw new Error("SAM2 chưa encode ảnh.");

  const coords = points.flatMap(point => [point.x, point.y]);
  const labels = points.map(point => point.label);
  const maskInput = previousMask
    ? new ort.Tensor("float32", previousMask, previousMaskShape || [1, 1, 256, 256])
    : new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
  const hasMaskInput = new ort.Tensor("float32", previousMask ? [1] : [0], [1]);

  const outputs = await decoderSession.run({
    image_embed: encodedImage.image_embed,
    high_res_feats_0: encodedImage.high_res_feats_0,
    high_res_feats_1: encodedImage.high_res_feats_1,
    point_coords: new ort.Tensor("float32", new Float32Array(coords), [1, points.length, 2]),
    point_labels: new ort.Tensor("float32", new Float32Array(labels), [1, points.length]),
    mask_input: maskInput,
    has_mask_input: hasMaskInput
  });

  const masks = outputs.masks || outputs[decoderSession.outputNames[0]];
  const scores = outputs.iou_predictions || outputs[decoderSession.outputNames[1]];
  const scoreData = Array.from(scores.cpuData || scores.data || []);
  let best = 0;
  for (let i = 1; i < scoreData.length; i++) if (scoreData[i] > scoreData[best]) best = i;

  const dims = masks.dims;
  const height = dims[dims.length - 2];
  const width = dims[dims.length - 1];
  const stride = width * height;
  const source = masks.cpuData || masks.data;
  const selected = new Float32Array(stride);
  selected.set(source.slice(best * stride, (best + 1) * stride));
  return { mask: selected, width, height, device };
}

self.onmessage = async event => {
  const { id, type, data } = event.data || {};
  try {
    if (type === "init") {
      await ensureReady();
      self.postMessage({ id, ok: true, data: { device } });
      return;
    }
    if (type === "encode") {
      await encode(new Float32Array(data.buffer), data.shape);
      self.postMessage({ id, ok: true, data: { device } });
      return;
    }
    if (type === "decode") {
      const previous = data.previousMask ? new Float32Array(data.previousMask) : null;
      const result = await decode(data.points, previous, data.previousMaskShape);
      self.postMessage(
        { id, ok: true, data: { mask: result.mask.buffer, width: result.width, height: result.height, device: result.device } },
        [result.mask.buffer]
      );
      return;
    }
    throw new Error("Lệnh SAM2 không hợp lệ.");
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
