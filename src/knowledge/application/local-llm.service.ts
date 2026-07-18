import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
};

@Injectable()
export class LocalLlmService {
  private readonly baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "");
  private readonly model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  private readonly accessClientId = process.env.OLLAMA_CF_ACCESS_CLIENT_ID;
  private readonly accessClientSecret =
    process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET;
  private readonly gatewayApiKey = process.env.OLLAMA_GATEWAY_API_KEY;

  isConfigured() {
    return Boolean(this.baseUrl) && this.hasCompleteAccessServiceToken();
  }

  async generate(prompt: string) {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        "Local LLM is not configured. Set OLLAMA_BASE_URL and OLLAMA_MODEL.",
      );
    }

    if (!this.hasCompleteAccessServiceToken()) {
      throw new ServiceUnavailableException(
        "Cloudflare Access configuration is incomplete. Set both OLLAMA_CF_ACCESS_CLIENT_ID and OLLAMA_CF_ACCESS_CLIENT_SECRET, or neither for an unprotected local Ollama instance.",
      );
    }

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.accessClientId
          ? { "CF-Access-Client-Id": this.accessClientId }
          : {}),
        ...(this.accessClientSecret
          ? { "CF-Access-Client-Secret": this.accessClientSecret }
          : {}),
        ...(this.gatewayApiKey
          ? { "X-LLM-Gateway-Key": this.gatewayApiKey }
          : {}),
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9,
        },
      }),
    }).catch((error: unknown) => {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? `Local LLM is unavailable: ${error.message}`
          : "Local LLM is unavailable.",
      );
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ServiceUnavailableException(
        `Local LLM request failed (${response.status}): ${body}`,
      );
    }

    const body = (await response.json()) as OllamaGenerateResponse;
    if (body.error) {
      throw new ServiceUnavailableException(`Local LLM error: ${body.error}`);
    }

    return (body.response ?? "").trim();
  }

  private hasCompleteAccessServiceToken() {
    return Boolean(this.accessClientId) === Boolean(this.accessClientSecret);
  }
}
