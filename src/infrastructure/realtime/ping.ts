import { HTTP_URL } from "@/infrastructure/realtime/roomClient";

async function timedGet(
  path: string,
  signal: AbortSignal,
): Promise<number | null> {
  const started = performance.now();
  try {
    const res = await fetch(`${HTTP_URL}${path}`, {
      method: "GET",
      cache: "no-store",
      signal,
    });
    if (!res.ok) return null;
    await res.arrayBuffer().catch(() => undefined);
    return Math.max(0, Math.round(performance.now() - started));
  } catch {
    return null;
  }
}

/**
 * Measure RTT to the Colyseus HTTP host via GET /health (fallback GET /rooms).
 * Soft-fails: returns null when the server is unreachable or times out.
 */
export async function measurePing(timeoutMs = 4000): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const health = await timedGet("/health", controller.signal);
    if (health != null) return health;
    return await timedGet("/rooms", controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
