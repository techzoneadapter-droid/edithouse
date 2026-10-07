import { NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/ai/ai-config-store";
import { AIError, loadModels } from "@/lib/ai/experiential-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { status } from "@/lib/ai/status";
import { failure, localRequest } from "@/lib/ai/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    localRequest(request);
    const body = await request.json();
    const provider = String(body.provider || "");

    if (provider === "openai") {
      const key = String(body.apiKey || "").trim();
      if (!key.startsWith("sk-") || key.length < 16) {
        throw new AIError("OpenAI API key không hợp lệ.", 401, "invalid_openai_key");
      }
      const model = typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : undefined;
      await new OpenAIProvider(key).validate();
      await writeConfig({
        ...await readConfig(),
        openaiApiKey: key,
        ...(model ? { openaiModel: model } : {})
      });
      return NextResponse.json(await status());
    }

    if (provider === "experiential") {
      const key = String(body.apiKey || "").trim();
      if (!/^xpl_[A-Za-z0-9_-]{8,}$/.test(key)) {
        throw new AIError("API key Experiential Labs không hợp lệ hoặc đã bị thu hồi.", 401);
      }
      await loadModels(key, true);
      await writeConfig({ ...await readConfig(), apiKey: key });
      return NextResponse.json(await status());
    }

    throw new AIError("Provider không hợp lệ.", 400, "invalid_provider");
  } catch (e) {
    return failure(e);
  }
}
