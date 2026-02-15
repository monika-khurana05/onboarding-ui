import { env } from '../lib/env';
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
  if (!body || typeof body !== 'object') {
    return null;
  }
  const record = body as ApiErrorResponseDto;
  if (typeof record.message === 'string' || typeof record.error === 'string') {
    return record;
  }
  return null;
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
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const baseUrl = env.apiBaseUrl || '/api';
  const url = buildApiUrl(path, baseUrl);
  const correlationId = createCorrelationId();

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(env.authToken ? { Authorization: `Bearer ${env.authToken}` } : {}),
        'X-Correlation-Id': correlationId,
        ...(options.headers ?? {})
      }
    });

    if (!response.ok) {
      let message = response.statusText || 'Request failed';
      let errorCode: string | undefined;
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const errorBody = (await response.json().catch(() => null)) as unknown;
        const parsed = parseErrorBody(errorBody);
        if (parsed) {
          message = parsed.message ?? parsed.error ?? message;
          errorCode = parsed.error;
        }
      }

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
