const DEFAULT_IMAGE_API_TIMEOUT_MS = 120_000;
const MIN_IMAGE_API_TIMEOUT_MS = 30_000;
const MAX_IMAGE_API_TIMEOUT_MS = 300_000;

export function getImageApiTimeoutMs() {
  const raw =
    process.env.IMAGE_API_TIMEOUT_MS ||
    process.env.OPENAI_IMAGE_TIMEOUT_MS ||
    "";
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_IMAGE_API_TIMEOUT_MS;
  }

  return Math.min(
    Math.max(Math.round(parsed), MIN_IMAGE_API_TIMEOUT_MS),
    MAX_IMAGE_API_TIMEOUT_MS,
  );
}
