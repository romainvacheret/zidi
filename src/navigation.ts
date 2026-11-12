export function graphHref(id: string) {
  return `#/graph/${encodeURIComponent(id)}`;
}

export function graphTargetFromHash(): string | null {
  const match = window.location.hash.match(/^#\/graph\/([^/]+)$/);
  try {
    const id = match ? decodeURIComponent(match[1]) : null;
    return id && Array.from(id).length <= 200 ? id : null;
  } catch {
    return null;
  }
}
