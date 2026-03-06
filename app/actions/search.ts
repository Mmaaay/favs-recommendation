"use server";

// In-memory throttle state — persists across requests within the same
// serverless instance. Cold starts reset it, which is acceptable.
let lastCallTs = 0;
const THROTTLE_MS = 2000;

export async function aiSearch(query: string) {
  const now = Date.now();

  if (now - lastCallTs < THROTTLE_MS) {
    const retryIn = Math.ceil((THROTTLE_MS - (now - lastCallTs)) / 1000);
    return { ok: false as const, error: `Throttled — try again in ${retryIn}s` };
  }

  lastCallTs = now;

  // TODO: replace with real AI / Google search integration
  console.log("[AI Search] firing for:", query);

  return { ok: true as const, query };
}
