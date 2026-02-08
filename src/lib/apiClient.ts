import { env } from './env';

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured.');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const url = new URL(path, env.apiBaseUrl).toString();

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(env.authToken ? { Authorization: `Bearer ${env.authToken}` } : {}),
        ...(options.headers ?? {})
      }
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      let errorMessage = response.statusText;
      if (contentType.includes('application/json')) {
        const errorBody = (await response.json().catch(() => null)) as unknown;
        if (
          errorBody &&
          typeof errorBody === 'object' &&
          'message' in errorBody &&
          typeof errorBody.message === 'string'
        ) {
          errorMessage = errorBody.message;
        }
      } else {
        const textBody = await response.text().catch(() => '');
        if (textBody) {
          errorMessage = textBody;
        }
      }
      throw new ApiError(`Request failed (${response.status}): ${errorMessage}`, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. You can safely retry.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
