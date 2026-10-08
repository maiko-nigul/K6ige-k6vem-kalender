export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const details = Array.isArray(data?.details)
      ? data.details
          .map(
            (item: { path: string; message: string }) =>
              `${item.path}: ${item.message}`,
          )
          .join(" · ")
      : "";
    throw new RequestError(
      details ||
        data?.error ||
        `Request failed (${response.status}). Please try again.`,
      response.status,
    );
  }
  return data as T;
}
