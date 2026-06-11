// Turn stored photo bytes into something an <img> tag can show.
// URLs are cached so the same photo isn't rebuilt on every render.
import type { Media } from '../lib/types.ts';

const cache = new Map<string, string>();

export function mediaUrl(m: Media): string {
  let url = cache.get(m.id);
  if (!url) {
    url = URL.createObjectURL(new Blob([m.data], { type: m.mime }));
    cache.set(m.id, url);
  }
  return url;
}
