import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aiConfiguration,
  completeAI,
  AIProviderError,
  type AIRequest,
} from "../lib/ai-provider.ts";
const request: AIRequest = {
  model: "openai/gpt-oss-120b",
  instructions: "Use only the supplied learning preferences.",
  input: [{ role: "user", content: "Explain recursion." }],
  max_output_tokens: 2500,
  store: false,
};
const config = aiConfiguration({
  AI_PROVIDER: "groq",
  GROQ_API_KEY: "test-groq-key",
  OPENAI_API_KEY: "unused-test-openai-key",
});
test("Groq is selected explicitly without using an existing paid OpenAI key", () => {
  assert.equal(
    aiConfiguration({ OPENAI_API_KEY: "test-openai" }).configured,
    false,
  );
  assert.equal(config.provider, "groq");
  assert.equal(config.model, "openai/gpt-oss-120b");
  assert.equal(
    aiConfiguration({ AI_PROVIDER: "openai", OPENAI_API_KEY: "test-openai" })
      .provider,
    "openai",
  );
});
test("Groq maps personal instructions and history to chat messages without leaking response reasoning", async () => {
  const answer = await completeAI(request, config, async (input, init) => {
    assert.equal(input, "https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages[0].content, request.instructions);
    assert.equal(body.messages[1].content, "Explain recursion.");
    assert.equal(body.max_completion_tokens, 2000);
    assert.equal(body.reasoning_effort, "low");
    assert.equal(body.store, undefined);
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "A function calls itself.",
            reasoning: "Private model reasoning",
          },
        },
      ],
    });
  });
  assert.equal(answer, "A function calls itself.");
});
test("Groq preserves strict JSON schema for plans and curricula", async () => {
  const format = {
    type: "json_schema" as const,
    name: "learning_path",
    strict: true,
    schema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
      additionalProperties: false,
    },
  };
  await completeAI(
    { ...request, text: { format }, max_output_tokens: 10000 },
    config,
    async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.response_format, {
        type: "json_schema",
        json_schema: { name: format.name, strict: true, schema: format.schema },
      });
      assert.equal(body.max_completion_tokens, 5000);
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: '{"title":"Practice"}' },
          },
        ],
      });
    },
  );
});
test("free-tier limits preserve retry timing and never call a paid fallback", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      completeAI(request, config, async () => {
        calls++;
        return Response.json(
          { error: { message: "rate limit" } },
          { status: 429, headers: { "Retry-After": "30" } },
        );
      }),
    (e) =>
      e instanceof AIProviderError && e.status === 429 && e.retryAfter === "30",
  );
  assert.equal(calls, 1);
});
test("incomplete drafts are rejected instead of becoming saved learning content", async () => {
  await assert.rejects(
    () =>
      completeAI(request, config, async () =>
        Response.json({
          choices: [
            { finish_reason: "length", message: { content: "Unfinished" } },
          ],
        }),
      ),
    /incomplete/,
  );
});
test("OpenAI remains opt-in and uses its original Responses protocol", async () => {
  const openai = aiConfiguration({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-openai",
  });
  assert.equal(
    await completeAI(
      { ...request, model: openai.model },
      openai,
      async (input, init) => {
        assert.equal(input, "https://api.openai.com/v1/responses");
        assert.equal(JSON.parse(String(init?.body)).store, false);
        return Response.json({
          status: "completed",
          output: [{ content: [{ type: "output_text", text: "Ready" }] }],
        });
      },
    ),
    "Ready",
  );
});
