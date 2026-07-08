const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "";

export function apiUrl(path: string) {
  return `${apiOrigin}${path}`;
}

export function socketOrigin() {
  return apiOrigin || undefined;
}
