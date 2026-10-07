import { readConfig, resolveOpenAIKey, resolveOpenAIModel } from "./ai-config-store";
import { OpenAIProvider } from "./openai-provider";
import { runRole } from "./provider";

export async function runArchitectureVision(
  prompt: string,
  imageDataUrl: string,
  schema: object,
  maxTokens = 8192
) {
  const config = await readConfig();
  const openaiKey = resolveOpenAIKey(config);

  if (openaiKey) {
    const model = resolveOpenAIModel(config);
    const ai = new OpenAIProvider(openaiKey);
    const response = await ai.chat(
      model,
      prompt,
      [imageDataUrl],
      schema,
      maxTokens,
      config.mode === "quality" ? "high" : config.mode === "economy" ? "low" : "medium"
    );
    return { response, model, provider: "openai" as const };
  }

  const fallback = await runRole("VISION_ANALYZE", (ai, model) =>
    ai.chat(model.slug, prompt, [imageDataUrl], schema, maxTokens)
  );
  return { response: fallback.result, model: fallback.model, provider: "experiential" as const };
}

export async function runArchitectureRefine(
  prompt: string,
  imageDataUrl: string,
  schema: object,
  maxTokens = 5000
) {
  const config = await readConfig();
  const openaiKey = resolveOpenAIKey(config);

  if (openaiKey) {
    const model = resolveOpenAIModel(config);
    const ai = new OpenAIProvider(openaiKey);
    const response = await ai.chat(
      model,
      prompt,
      [imageDataUrl],
      schema,
      maxTokens,
      config.mode === "quality" ? "high" : "medium"
    );
    return { response, model, provider: "openai" as const };
  }

  const fallback = await runRole("MASK_ANALYZE", (ai, model) =>
    ai.chat(model.slug, prompt, [imageDataUrl], schema, maxTokens)
  );
  return { response: fallback.result, model: fallback.model, provider: "experiential" as const };
}
