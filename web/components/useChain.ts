"use client";

import type { ApiPromise } from "@polkadot/api";
import { useEffect, useState } from "react";
import { getApi } from "@/lib/client-chain";

export function useApi() {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getApi()
      .then((a) => !cancelled && setApi(a))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);
  return { api, error };
}

/** Seconds since the last block's timestamp; null until known. */
export function useLagSeconds(api: ApiPromise | null) {
  const [lag, setLag] = useState<number | null>(null);
  useEffect(() => {
    if (!api) return;
    let live = true;
    const tick = async () => {
      const now = (await api.query.timestamp.now()).toNumber();
      if (live) setLag(Math.max(0, (Date.now() - now) / 1000));
    };
    void tick();
    const t = setInterval(tick, 15_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [api]);
  return lag;
}
