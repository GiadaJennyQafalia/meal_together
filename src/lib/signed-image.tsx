import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "ricette-immagini";
const TTL_SECONDS = 60 * 60; // 1h signed URL
const CACHE_MS = 55 * 60 * 1000; // refresh a bit before expiry

type CacheEntry = { url: string; expires: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function fetchSignedUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expires > now) return cached.url;

  const existing = inflight.get(path);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    cache.set(path, { url: data.signedUrl, expires: Date.now() + CACHE_MS });
    return data.signedUrl;
  })();
  inflight.set(path, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(path);
  }
}

/**
 * Resolve `value` to a usable image URL.
 * - null/undefined → null
 * - http(s) URL   → returned as-is (retrocompat with legacy public URLs)
 * - anything else → treated as a path in the `ricette-immagini` bucket and
 *   resolved to a short-lived signed URL.
 */
export function useSignedImage(value: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!value) return null;
    if (isHttpUrl(value)) return value;
    const cached = cache.get(value);
    return cached && cached.expires > Date.now() ? cached.url : null;
  });

  useEffect(() => {
    if (!value) {
      setResolved(null);
      return;
    }
    if (isHttpUrl(value)) {
      setResolved(value);
      return;
    }
    let cancelled = false;
    fetchSignedUrl(value).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return resolved;
}

export function SignedImage({
  value,
  alt = "",
  className,
}: {
  value: string | null | undefined;
  alt?: string;
  className?: string;
}) {
  const src = useSignedImage(value);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}