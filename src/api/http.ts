import { apiTimeoutMs, env } from '../lib/env';
import type { ApiErrorResponseDto } from './types';

export class ApiError extends Error {
  status?: number;
  error?: string;
  correlationId?: string;

  constructor(message: string, options?: { status?: number; error?: string; correlationId?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.error = options?.error;
    this.correlationId = options?.correlationId;
  }
}

export type HttpRequestOptions = RequestInit & {
  timeoutMs?: number;
};

function createCorrelationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2, 10);
  return `cpx-${Date.now()}-${random}`;
}

function parseErrorBody(body: unknown): ApiErrorResponseDto | null {
  if (typeof body === 'string' && body.trim()) {
    return { message: body };
  }
  if (!body || typeof body !== 'object') {
    return null;
  }
  const record = body as ApiErrorResponseDto;
  if (typeof record.message === 'string' || typeof record.error === 'string') {
    return record;
  }
  return null;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'NetworkError';
  }
  return error instanceof TypeError;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      if (attempt < retries && isNetworkError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

async function parseErrorResponse(response: Response): Promise<{ message: string; errorCode?: string }> {
  const fallbackMessage = response.statusText || 'Request failed';
  const contentType = response.headers.get('content-type') ?? '';
  let message = fallbackMessage;
  let errorCode: string | undefined;

  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    rawText = '';
  }

  const trimmed = rawText.trim();
  let parsed: ApiErrorResponseDto | null = null;

  if (trimmed) {
    if (contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = parseErrorBody(JSON.parse(trimmed));
      } catch {
        parsed = null;
      }
    } else {
      parsed = parseErrorBody(trimmed);
    }
  }

  if (parsed) {
    const parsedMessage = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    const parsedError = typeof parsed.error === 'string' ? parsed.error.trim() : '';
    message = parsedMessage || parsedError || message;
    errorCode = parsedError || undefined;
  } else if (trimmed) {
    message = trimmed;
  }

  return { message, errorCode };
}

function buildHeaders(options: HttpRequestOptions, correlationId: string): Headers {
  const headers = new Headers(options.headers ?? {});

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (env.authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${env.authToken}`);
  }

  headers.set('X-Correlation-Id', correlationId);
  return headers;
}

function buildApiUrl(path: string, baseUrl: string): string {
  const resolvedBaseUrl = new URL(baseUrl, window.location.origin);
  const basePath =
    resolvedBaseUrl.pathname === '/' ? '' : resolvedBaseUrl.pathname.replace(/\/$/, '');
  let normalizedPath = path.trim();

  if (basePath) {
    if (normalizedPath === basePath) {
      normalizedPath = '';
    } else if (normalizedPath.startsWith(`${basePath}/`)) {
      normalizedPath = normalizedPath.slice(basePath.length);
    }
  }

  normalizedPath = normalizedPath.replace(/^\/+/, '');
  const basePrefix = `${resolvedBaseUrl.origin}${basePath}/`;
  return new URL(normalizedPath, basePrefix).toString();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return 'Unexpected error occurred.';
}

export async function httpRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? apiTimeoutMs);
  const baseUrl = env.apiBaseUrl;
  const url = buildApiUrl(path, baseUrl);
  const correlationId = createCorrelationId();
  const headers = buildHeaders(options, correlationId);

  try {
    const response = await fetchWithRetry(url, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers
    });

    if (!response.ok) {
      const { message, errorCode } = await parseErrorResponse(response);

      throw new ApiError(message, {
        status: response.status,
        error: errorCode,
        correlationId
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out. You can safely retry.', { correlationId });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
