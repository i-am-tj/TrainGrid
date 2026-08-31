const VIDEO_ID = /^[\w-]{11}$/;

function videoIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const id = params.get("v")?.trim() ?? "";
  return VIDEO_ID.test(id) ? id : null;
}

export function parseYouTubeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  }

  if (host !== "youtube.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "watch") {
    const id = videoIdFromSearch(url.search);
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  }
  if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") && parts[1]) {
    const id = parts[1];
    return VIDEO_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  }
  const fallback = videoIdFromSearch(url.search);
  return fallback ? `https://www.youtube.com/watch?v=${fallback}` : null;
}
