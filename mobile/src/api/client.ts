const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const API_URL = `${rawApiUrl.replace(/\/+$/, "")}/api`;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "La solicitud a la API no se pudo completar.");
  return data as T;
}
