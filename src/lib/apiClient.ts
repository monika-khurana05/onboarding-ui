import { ApiError, httpRequest, type HttpRequestOptions } from '../api/http';

export { ApiError };

export async function apiFetch<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  return httpRequest<T>(path, options);
}
