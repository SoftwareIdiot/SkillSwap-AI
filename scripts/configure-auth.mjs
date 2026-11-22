import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
const prompt = createInterface({ input: stdin, output: stdout });
try {
  console.log(
    "Connect SkillSwap accounts. Enter only your Supabase public/publishable key. Keep Google client secrets in the Supabase dashboard.",
  );
  const project = (await prompt.question("Supabase project URL: "))
    .trim()
    .replace(/\/$/, "");
  const url = new URL(project);
  if (
    url.protocol !== "https:" &&
    !(
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.protocol === "http:"
    )
  )
    throw new Error(
      "Use an HTTPS Supabase project URL (or a local development address).",
    );
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    project.includes("your-project")
  )
    throw new Error("Use the project root URL, without a path or credentials.");
  const key = (
    await prompt.question("Supabase public/publishable key: ")
  ).trim();
  if (key.length < 20 || /[\r\n\s]/.test(key) || key.startsWith("sb_secret_"))
    throw new Error("Enter a public/publishable key, not a secret key.");
  if (key.split(".").length === 3) {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    );
    if (payload.role !== "anon")
      throw new Error(
        "Use the anon public key; never use a service-role key here.",
      );
  } else if (!key.startsWith("sb_publishable_"))
    throw new Error(
      "Expected a Supabase publishable key or legacy anon public key.",
    );
  const originInput =
    (
      await prompt.question("SkillSwap site origin [http://127.0.0.1:3000]: ")
    ).trim() || "http://127.0.0.1:3000";
  const site = new URL(originInput);
  if (
    !["http:", "https:"].includes(site.protocol) ||
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash
  )
    throw new Error("Enter only the site origin, without a path.");
  let env = await readFile(
    new URL("../.env.local", import.meta.url),
    "utf8",
  ).catch((e) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  for (const [name, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: project,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
    NEXT_PUBLIC_SITE_URL: site.origin,
  })) {
    const line = `${name}=${JSON.stringify(value)}`,
      pattern = new RegExp(`^${name}=.*$`, "m");
    env = pattern.test(env)
      ? env.replace(pattern, () => line)
      : env + (env.endsWith("\n") || !env ? "" : "\n") + line + "\n";
  }
  await writeFile(new URL("../.env.local", import.meta.url), env, {
    mode: 0o600,
  });
  console.log(
    `Saved .env.local without changing AI settings. Next: apply missing migrations, enable Google in Supabase, and allow ${site.origin}/auth/callback. Restart SkillSwap, then open ${site.origin}/auth to try Google sign-in.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
}
