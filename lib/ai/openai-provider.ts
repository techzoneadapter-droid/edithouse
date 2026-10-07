import { AIError } from "./experiential-provider";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== "message") continue;
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if ((part?.type === "output_text" || part?.type === "text") && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return "";
}

export class OpenAIProvider {
  constructor(private key: string) {}

  private async request(path: string, init: RequestInit, timeout = 90000) {
    let response: Response;
    try {
      response = await fetch(OPENAI_BASE_URL + path, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          ...(init.headers || {})
        },
        signal: AbortSignal.timeout(timeout),
        cache: "no-store"
      });
    } catch {
      throw new AIError("Không thể kết nối OpenAI API.", 504, "openai_timeout");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = String(data?.error?.code || data?.error?.type || "openai_error");
      const message =
        response.status === 401
          ? "OpenAI API key không hợp lệ hoặc đã bị thu hồi."
          : String(data?.error?.message || `OpenAI HTTP ${response.status}`).replaceAll(this.key, "[REDACTED]");
      throw new AIError(message, response.status, code);
    }
    return data;
  }

  async validate() {
    await this.request("/models?limit=1", { method: "GET" }, 20000);
    return true;
  }

  async chat(
    model: string,
    prompt: string,
    images: string[] = [],
    schema?: object,
    maxTokens = 8192,
    reasoningEffort: "low" | "medium" | "high" = "medium"
  ) {
    const body: any = {
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...images.map(image_url => ({
              type: "input_image",
              image_url,
              detail: "high"
            }))
          ]
        }
      ],
      max_output_tokens: maxTokens,
      reasoning: { effort: reasoningEffort }
    };

    if (schema) {
      body.text = {
        format: {
          type: "json_schema",
          name: "edithouse_architecture",
          strict: true,
          schema
        }
      };
    }

    const data = await this.request(
      "/responses",
      { method: "POST", body: JSON.stringify(body) },
      120000
    );
    const text = extractOutputText(data);
    if (!text) throw new AIError("OpenAI không trả nội dung phân tích.", 502, "openai_empty_output");

    // Keep the same shape as the existing provider so the rest of EditHouse can stay provider-agnostic.
    return {
      choices: [{ message: { content: text }, finish_reason: data?.status === "completed" ? "stop" : data?.status }],
      response_id: data?.id,
      usage: data?.usage,
      provider: "openai"
    };
  }
}
