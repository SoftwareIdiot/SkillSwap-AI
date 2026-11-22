import { test } from "node:test";
import assert from "node:assert/strict";
import { requestOrigin, isSameOrigin } from "../lib/request-origin.ts";
test("approved HTTPS tunnel works while foreign and spoofed origins fail", () => {
  const previous = process.env.SKILLSWAP_PUBLIC_ORIGIN;
  process.env.SKILLSWAP_PUBLIC_ORIGIN = "https://preview.example.test";
  const req = (headers: Record<string, string>) => ({
    url: "http://localhost:3000/auth/google",
    headers: new Headers({ host: "localhost:3000", ...headers }),
  });
  try {
    assert.equal(
      isSameOrigin({
        url: "https://localhost:3000/auth/google",
        headers: new Headers({
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "x-forwarded-host": "preview.example.test",
          "x-forwarded-proto": "https",
        }),
      }),
      true,
    );
    assert.equal(
      isSameOrigin(req({ origin: "https://preview.example.test" })),
      true,
    );
    assert.equal(
      requestOrigin(
        req({
          "x-forwarded-host": "preview.example.test",
          "x-forwarded-proto": "https",
        }),
      ),
      "https://preview.example.test",
    );
    assert.equal(
      requestOrigin(req({ "x-forwarded-proto": "https" })),
      "https://preview.example.test",
    );
    assert.equal(isSameOrigin(req({ origin: "http://localhost:3000" })), true);
    assert.equal(
      isSameOrigin(
        req({
          origin: "http://localhost:3000",
          "x-forwarded-host": "preview.example.test",
          "x-forwarded-proto": "https",
        }),
      ),
      true,
    );
    assert.equal(
      isSameOrigin(
        req({
          origin: "http://localhost:3000",
          "x-forwarded-host": "other.example.test",
          "x-forwarded-proto": "https",
        }),
      ),
      false,
    );
    assert.equal(
      isSameOrigin(
        req({
          origin: "https://evil.test",
          "x-forwarded-host": "evil.test",
          "x-forwarded-proto": "https",
        }),
      ),
      false,
    );
    assert.equal(isSameOrigin(req({ origin: "null" })), false);
    delete process.env.SKILLSWAP_PUBLIC_ORIGIN;
    assert.equal(
      isSameOrigin(
        req({
          origin: "https://preview.example.test",
          "x-forwarded-host": "preview.example.test",
        }),
      ),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.SKILLSWAP_PUBLIC_ORIGIN;
    else process.env.SKILLSWAP_PUBLIC_ORIGIN = previous;
  }
});
