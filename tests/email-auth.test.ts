import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emailCredentials,
  emailSignup,
  emailCode,
  signupNeedsCode,
} from "../lib/email-auth.ts";
test("existing-account signup never leads to a misleading code screen", () => {
  assert.equal(signupNeedsCode({ identities: [] }), false);
  assert.equal(signupNeedsCode(null), false);
  assert.equal(
    signupNeedsCode({
      identities: [{ provider: "google" }],
      email_confirmed_at: "2026-11-08T12:00:00Z",
    }),
    false,
  );
  assert.equal(signupNeedsCode({ identities: [{ provider: "email" }] }), true);
});
test("email signup requires matching passwords and never includes confirmation in provider credentials", () => {
  const fields = {
    email: " learner@gmail.com ",
    password: "test-password-42",
    confirmation: "test-password-42",
  };
  assert.equal(emailSignup.safeParse(fields).success, true);
  assert.equal(
    emailSignup.safeParse({ ...fields, confirmation: "different-password" })
      .success,
    false,
  );
  assert.equal(
    emailSignup.safeParse({
      ...fields,
      password: "short",
      confirmation: "short",
    }).success,
    false,
  );
  const safe = emailCredentials.parse(fields);
  assert.equal(safe.email, "learner@gmail.com");
  assert.ok(!("confirmation" in safe));
});
test("email OTP accepts numeric codes and rejects links, malformed email, and incomplete codes", () => {
  assert.equal(
    emailCode.safeParse({ email: "learner@gmail.com", token: "123456" })
      .success,
    true,
  );
  for (const token of ["12345", "12345678901", "https://bad.test", "123ab6"])
    assert.equal(
      emailCode.safeParse({ email: "learner@gmail.com", token }).success,
      false,
    );
  assert.equal(
    emailCode.safeParse({ email: "invalid", token: "123456" }).success,
    false,
  );
});
