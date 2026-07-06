
// lib/utils/apiFetch.ts
// A lightweight fetch wrapper for client-side API calls.
// Automatically includes the auth cookie, handles JSON, and throws on non-2xx responses.

interface ApiFetchOptions extends RequestInit {
  baseUrl?: string;
}

export async function apiFetch<T = any>(
  input: string | URL | Request,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { baseUrl = '', headers, ...restOptions } = options;

  const url = baseUrl ? `${baseUrl}${input}` : input;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
    ...restOptions,
  });

  const clonedResponse = response.clone();

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await clonedResponse.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response as T;
}