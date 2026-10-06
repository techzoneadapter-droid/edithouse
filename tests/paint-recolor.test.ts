import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { recolorPaintSurfaces } from "../lib/paint-recolor";

test("paint recolor keeps unmasked pixels and preserves shading", async () => {
  const width = 20;
  const height = 1;
  const rgb = Buffer.alloc(width * 3);
  const mask = Buffer.alloc(width * 4);

  for (let x = 0; x < width; x++) {
    const value = 35 + x * 8;
    rgb[x * 3] = value;
    rgb[x * 3 + 1] = value;
    rgb[x * 3 + 2] = value;

    mask[x * 4] = 255;
    mask[x * 4 + 1] = 255;
    mask[x * 4 + 2] = 255;
    mask[x * 4 + 3] = x >= 5 ? 255 : 0;
  }

  const original = await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const maskPng = await sharp(mask, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const result = await recolorPaintSurfaces(original, [{
    maskDataUrl: "data:image/png;base64," + maskPng.toString("base64"),
    hex: "#B84035",
    finish: "Mờ"
  }]);

  const decoded = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number) => [
    decoded.data[x * 4],
    decoded.data[x * 4 + 1],
    decoded.data[x * 4 + 2]
  ];

  assert.deepEqual(px(0), [35, 35, 35]);
  assert.ok(px(10)[0] > px(10)[1], "painted pixel should follow target red hue");
  assert.ok(px(18)[0] > px(7)[0], "brighter source area should remain brighter after recolor");
});
