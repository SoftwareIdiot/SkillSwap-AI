type IncomingRequest = { headers: Headers; url: string };
// Next may canonicalize a loopback request URL to localhost. The browser's Host
// remains the address actually visited, which is the boundary for origin checks.
export function requestOrigin(request: IncomingRequest) {
  const parsed = new URL(request.url);
  const direct = new URL(
    `${parsed.protocol}//${request.headers.get("host") || parsed.host}`,
  ).origin;
  try {
    const approved = new URL(process.env.SKILLSWAP_PUBLIC_ORIGIN || "");
    if (
      approved.protocol === "https:" &&
      !approved.username &&
      !approved.password &&
      approved.pathname === "/" &&
      !approved.search &&
      !approved.hash
    ) {
      // Trust only the configured public site, never arbitrary proxy headers.
      if (
        request.headers.get("origin") === approved.origin ||
        new URL(direct).host === approved.host ||
        request.headers.get("x-forwarded-host")?.split(",")[0].trim() ===
          approved.host ||
        request.headers.get("x-original-host") === approved.host ||
        (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ===
          "https" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(
            new URL(direct).hostname,
          ))
      )
        return approved.origin;
    }
  } catch {
    /* No approved public preview; retain local origin checks. */
  }
  return direct;
}
export function isSameOrigin(request: IncomingRequest) {
  const raw = request.headers.get("origin");
  if (!raw) return false;
  try {
    if (new URL(raw).origin !== raw) return false;
    const expected = requestOrigin(request);
    if (raw === expected) return true;
    // VS Code rewrites a matching public Origin to the local upstream Origin.
    const parsed = new URL(request.url);
    const upstream = new URL(
      `${parsed.protocol}//${request.headers.get("host") || parsed.host}`,
    );
    const approved = new URL(process.env.SKILLSWAP_PUBLIC_ORIGIN || "");
    return (
      expected === approved.origin &&
      approved.protocol === "https:" &&
      request.headers.get("x-forwarded-host")?.split(",")[0].trim() ===
        approved.host &&
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ===
        "https" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname) &&
      ["http:", "https:"].includes(new URL(raw).protocol) &&
      new URL(raw).host === upstream.host
    );
  } catch {
    return false;
  }
}
