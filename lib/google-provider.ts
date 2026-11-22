export type GoogleProviderState =
  "missing" | "disabled" | "ready" | "unreachable";
export async function googleProviderState(
  config: { url?: string; key?: string },
  fetcher: typeof fetch = fetch,
): Promise<GoogleProviderState> {
  if (!config.url || !config.key || config.url.includes("your-project"))
    return "missing";
  try {
    const response = await fetcher(
      `${config.url.replace(/\/$/, "")}/auth/v1/settings`,
      {
        headers: { apikey: config.key },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return "unreachable";
    const settings = await response.json();
    return settings.external?.google === true ? "ready" : "disabled";
  } catch {
    return "unreachable";
  }
}
