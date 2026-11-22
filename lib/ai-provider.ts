export type AIProvider = "groq" | "openai";
export function aiConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  const provider: AIProvider = env.AI_PROVIDER === "openai" ? "openai" : "groq";
  const model = (
    provider === "groq"
      ? env.GROQ_MODEL || "openai/gpt-oss-120b"
      : env.OPENAI_MODEL || "gpt-6-luna"
  ).trim();
  const key = (
    provider === "groq" ? env.GROQ_API_KEY : env.OPENAI_API_KEY
  )?.trim();
  const extra = provider === "groq" ? env.GROQ_MODELS : env.OPENAI_MODELS;
  return {
    provider,
    model,
    key,
    configured: !!key,
    models: [
      ...new Set(
        [model, ...(extra || "").split(",")]
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ],
  };
}
export type AIRequest = {
  model: string;
  instructions: string;
  input: { role: "user" | "assistant"; content: string }[];
  max_output_tokens: number;
  store: boolean;
  text?: {
    format: {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
};
export class AIProviderError extends Error {
  status: number;
  retryAfter?: string;
  constructor(
    message: string,
    status = 502,
    retryAfter?: string,
  ) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export async function completeAI(
  request: AIRequest,
  config = aiConfiguration(),
  fetcher: typeof fetch = fetch,
) {
  if (!config.configured)
    throw new AIProviderError(
      `Add the ${config.provider === "groq" ? "Groq" : "OpenAI"} API key on the server to enable AI.`,
      503,
    );
  if (!config.models.includes(request.model))
    throw new AIProviderError("Choose an available AI model in Settings.", 400);
  const groq = config.provider === "groq";
  const body = groq
    ? {
        model: request.model,
        messages: [
          { role: "system", content: request.instructions },
          ...request.input,
        ],
        max_completion_tokens: Math.min(
          request.max_output_tokens,
          request.text ? 5000 : 2000,
        ),
        ...(request.model.startsWith("openai/gpt-oss-")
          ? { reasoning_effort: "low" }
          : {}),
        ...(request.text
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: request.text.format.name,
                  strict: request.text.format.strict,
                  schema: request.text.format.schema,
                },
              },
            }
          : {}),
      }
    : request;
  // Provider selection is explicit. A free-tier error never falls back to paid OpenAI.
  const response = await fetcher(
    groq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    },
  );
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    const retryAfter = retry && /^\d+$/.test(retry) ? retry : undefined;
    throw new AIProviderError(
      response.status === 429
        ? "Your AI provider's request or token allowance is temporarily exhausted. Wait before retrying; no paid provider will be used."
        : response.status === 401 || response.status === 403
          ? "The AI provider rejected the server API key or model permission. Check the selected provider's configuration."
          : "The AI provider could not complete this request. Try again later or check its model configuration.",
      response.status === 429 ? 429 : 502,
      retryAfter,
    );
  }
  const result = await response.json();
  let answer: string;
  if (groq) {
    const choice = result.choices?.[0];
    if (choice?.finish_reason !== "stop" || choice?.message?.refusal)
      throw new AIProviderError(
        "The AI response was incomplete or declined. Try a smaller or more specific request.",
      );
    answer = choice?.message?.content;
  } else {
    if (result.status === "incomplete")
      throw new AIProviderError(
        "The AI response was incomplete. Try a smaller request.",
      );
    answer = (result.output || [])
      .flatMap(
        (item: { content?: { type: string; text?: string }[] }) =>
          item.content || [],
      )
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text: string }) => c.text)
      .join("\n");
  }
  if (typeof answer !== "string" || !answer.trim())
    throw new AIProviderError(
      "The AI provider returned an empty response. Please try again.",
    );
  if (request.text) {
    try {
      JSON.parse(answer);
    } catch {
      throw new AIProviderError(
        "The AI returned an invalid learning draft. Try a smaller request; nothing has been saved.",
      );
    }
  }
  return answer.trim();
}
