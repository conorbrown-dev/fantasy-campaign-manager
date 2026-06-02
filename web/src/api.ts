const apiOrigin =
  import.meta.env.VITE_API_ORIGIN ??
  (import.meta.env.DEV ? "http://localhost:3000" : "");

export function apiUrl(path: string) {
  return `${apiOrigin}${path}`;
}

export function socketOrigin() {
  return apiOrigin || undefined;
}
