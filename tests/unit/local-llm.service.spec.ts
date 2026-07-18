import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalLlmService } from "../../src/knowledge/application/local-llm.service";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.unstubAllGlobals();
});

describe("LocalLlmService", () => {
  it("authenticates requests to a Cloudflare Access-protected Ollama host", async () => {
    process.env.OLLAMA_BASE_URL = "https://llm.example.com/";
    process.env.OLLAMA_MODEL = "qwen3";
    process.env.OLLAMA_CF_ACCESS_CLIENT_ID = "token-client-id";
    process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET = "token-client-secret";
    process.env.OLLAMA_GATEWAY_API_KEY = "gateway-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: "  A generated answer.  " }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new LocalLlmService().generate("Tell me a story");

    expect(result).toBe("A generated answer.");
    expect(fetchMock).toHaveBeenCalledWith("https://llm.example.com/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Id": "token-client-id",
        "CF-Access-Client-Secret": "token-client-secret",
        "X-LLM-Gateway-Key": "gateway-secret",
      },
      body: JSON.stringify({
        model: "qwen3",
        prompt: "Tell me a story",
        stream: false,
        options: { temperature: 0.2, top_p: 0.9 },
      }),
    });
  });

  it("rejects a partial Cloudflare Access service token", async () => {
    process.env.OLLAMA_BASE_URL = "https://llm.example.com";
    process.env.OLLAMA_CF_ACCESS_CLIENT_ID = "token-client-id";
    delete process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET;

    await expect(new LocalLlmService().generate("Tell me a story")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
