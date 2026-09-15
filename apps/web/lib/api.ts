export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { timestamp: string; path: string };
}

export interface ApiError {
  success: false;
  error: { code: number; message: string; details?: unknown };
  meta: { timestamp: string; path: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Thin fetch wrapper matching the API's consistent response envelope. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  return (await res.json()) as ApiResponse<T>;
}
