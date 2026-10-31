"use client";

import type { ApiPromise } from "@polkadot/api";
import { createPublicClient, erc20Abi, http } from "viem";
import { erc20Address, portaldot, SUBSTRATE_WS } from "./portaldot";

let apiPromise: Promise<ApiPromise> | undefined;

/** Browser-side connection. The 1.1 MB metadata is only fetched when a page needs a wallet flow. */
export function getApi(): Promise<ApiPromise> {
  if (!apiPromise) {
    const created = (async () => {
      const [{ ApiPromise, WsProvider }, { default: bundled }] = await Promise.all([
        import("@polkadot/api"),
        import("./metadata.json"),
      ]);
      return ApiPromise.create({
        provider: new WsProvider(SUBSTRATE_WS),
        noInitWarn: true,
        metadata: { [`${bundled.genesisHash}-${bundled.specVersion}`]: bundled.metadata as `0x${string}` },
      });
    })();
    created.catch(() => {
      if (apiPromise === created) apiPromise = undefined;
    });
    apiPromise = created;
  }
  return apiPromise;
}

export const evmClient = createPublicClient({ chain: portaldot, transport: http(undefined, { batch: true }) });

/** eth-rpc answers some reads with a transient revert during halts, so reads get a few tries. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

export async function readTotalSupply(assetId: number, attempts = 4): Promise<bigint | null> {
  try {
    return await withRetry(
      () => evmClient.readContract({ address: erc20Address(assetId), abi: erc20Abi, functionName: "totalSupply" }),
      attempts,
    );
  } catch {
    return null;
  }
}

/** Decimal string → base units, rejecting more fractional digits than the asset has. */
export function parseAmount(input: string, decimals: number): bigint | null {
  const m = /^(\d{1,24})(?:\.(\d{1,24}))?$/.exec(input.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return BigInt(m[1] + frac.padEnd(decimals, "0"));
}
