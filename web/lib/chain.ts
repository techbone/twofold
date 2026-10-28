import "@polkadot/api-augment";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { cacheLife } from "next/cache";
import { createPublicClient, erc20Abi, http } from "viem";
import bundled from "./metadata.json";
import { erc20Address, portaldot, SUBSTRATE_WS } from "./portaldot";

let apiPromise: Promise<ApiPromise> | undefined;

/**
 * One connection per warm server instance. Metadata is bundled (see `npm run metadata`) because
 * downloading it cost ~8s on every cold start; if the runtime upgrades, the spec version no
 * longer matches the key below and @polkadot/api fetches fresh metadata on its own.
 * A failed or dropped connection is discarded so the next request builds a new one instead of
 * reusing a dead promise.
 */
function substrate(): Promise<ApiPromise> {
  if (!apiPromise) {
    const provider = new WsProvider(SUBSTRATE_WS);
    const created = ApiPromise.create({
      provider,
      noInitWarn: true,
      metadata: { [`${bundled.genesisHash}-${bundled.specVersion}`]: bundled.metadata as `0x${string}` },
    });
    const reset = () => {
      if (apiPromise === created) apiPromise = undefined;
      void provider.disconnect().catch(() => {});
    };
    created.catch(reset);
    provider.on("error", reset);
    provider.on("disconnected", reset);
    apiPromise = created;
  }
  return apiPromise;
}

// Batched so 20+ totalSupply() reads share one round trip.
const evm = createPublicClient({ chain: portaldot, transport: http(undefined, { batch: true }) });

export type SupplyCheck = "match" | "mismatch" | "unreadable";

export type AssetRow = {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
  erc20: string;
  nativeSupply: string;
  evmSupply: string | null;
  check: SupplyCheck;
  holders: number;
  hasPool: boolean;
  isSufficient: boolean;
  status: string;
};

export type Directory = { block: number; blockTime: string; readAt: string; assets: AssetRow[] };

/**
 * The eth-rpc node intermittently answers precompile reads with a "memory allocation error" revert,
 * then recovers seconds later (seen during the 2026-10-28 testnet halt). Retry a few times before
 * calling a read unreadable.
 */
async function withRetry<T>(read: () => Promise<T>, attempts = 4): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await read();
    } catch {
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}

function decodeText(bytes: { toUtf8(): string; toHex(): string }): string {
  try {
    return bytes.toUtf8();
  } catch {
    return bytes.toHex();
  }
}

/** Every native asset with both views of its supply. Chain state is the only source. */
export async function getDirectory(): Promise<Directory> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 600 });

  const api = await substrate();
  const [details, metadata, poolKeys, header, now] = await Promise.all([
    api.query.assets.asset.entries(),
    api.query.assets.metadata.entries(),
    api.query.assetConversion.pools.keys(),
    api.rpc.chain.getHeader(),
    api.query.timestamp.now(),
  ]);

  const meta = new Map(metadata.map(([k, m]) => [k.args[0].toNumber(), m]));
  const pooled = new Set<number>();
  for (const k of poolKeys) {
    const [a, b] = k.args[0].toJSON() as [Record<string, unknown>, Record<string, unknown>];
    if ("native" in a && "withId" in b) pooled.add(Number(b.withId));
  }

  const assets = await Promise.all(
    details
      .filter(([, d]) => d.isSome)
      .map(async ([k, opt]): Promise<AssetRow> => {
        const id = k.args[0].toNumber();
        const d = opt.unwrap();
        const m = meta.get(id);
        const erc20 = erc20Address(id);
        const nativeSupply = d.supply.toBigInt();
        const evmSupply = await withRetry(() =>
          evm.readContract({ address: erc20, abi: erc20Abi, functionName: "totalSupply" }),
        );
        return {
          id,
          name: m ? decodeText(m.name) : "",
          symbol: m ? decodeText(m.symbol) : "",
          decimals: m ? m.decimals.toNumber() : 0,
          erc20,
          nativeSupply: nativeSupply.toString(),
          evmSupply: evmSupply === null ? null : evmSupply.toString(),
          check: evmSupply === null ? "unreadable" : evmSupply === nativeSupply ? "match" : "mismatch",
          holders: d.accounts.toNumber(),
          hasPool: pooled.has(id),
          isSufficient: d.isSufficient.isTrue,
          status: d.status.type,
        };
      }),
  );

  assets.sort((a, b) => a.id - b.id);
  return {
    block: header.number.toNumber(),
    blockTime: new Date(now.toNumber()).toISOString(),
    readAt: new Date().toISOString(),
    assets,
  };
}

export type AssetDetail = {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  erc20: string;
  isSufficient: boolean;
  status: string;
  hasPool: boolean;
  native: {
    owner: string;
    issuer: string;
    admin: string;
    freezer: string;
    supply: string;
    accounts: number;
    minBalance: string;
    deposit: string;
  };
  evm: {
    totalSupply: string | null;
    decimals: number | null;
    name: string | null;
    symbol: string | null;
  };
  block: number;
  blockTime: string;
  readAt: string;
};

/** One asset, both views. Returns null when no such asset exists on the native side. */
export async function getAsset(id: number): Promise<AssetDetail | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 600 });

  const api = await substrate();
  const [opt, m, poolKeys, header, now] = await Promise.all([
    api.query.assets.asset(id),
    api.query.assets.metadata(id),
    api.query.assetConversion.pools.keys(),
    api.rpc.chain.getHeader(),
    api.query.timestamp.now(),
  ]);
  if (opt.isNone) return null;
  const d = opt.unwrap();
  const erc20 = erc20Address(id);

  const read = <T>(functionName: "totalSupply" | "decimals" | "name" | "symbol") =>
    withRetry(() => evm.readContract({ address: erc20, abi: erc20Abi, functionName }) as Promise<T>);
  const [totalSupply, evmDecimals, evmName, evmSymbol] = await Promise.all([
    read<bigint>("totalSupply"),
    read<number>("decimals"),
    read<string>("name"),
    read<string>("symbol"),
  ]);

  const hasPool = poolKeys.some((k) => {
    const [a, b] = k.args[0].toJSON() as [Record<string, unknown>, Record<string, unknown>];
    return "native" in a && "withId" in b && Number(b.withId) === id;
  });

  return {
    id,
    symbol: decodeText(m.symbol),
    name: decodeText(m.name),
    decimals: m.decimals.toNumber(),
    erc20,
    isSufficient: d.isSufficient.isTrue,
    status: d.status.type,
    hasPool,
    native: {
      owner: d.owner.toString(),
      issuer: d.issuer.toString(),
      admin: d.admin.toString(),
      freezer: d.freezer.toString(),
      supply: d.supply.toBigInt().toString(),
      accounts: d.accounts.toNumber(),
      minBalance: d.minBalance.toBigInt().toString(),
      deposit: d.deposit.toBigInt().toString(),
    },
    evm: {
      totalSupply: totalSupply === null ? null : totalSupply.toString(),
      decimals: evmDecimals === null ? null : Number(evmDecimals),
      name: evmName,
      symbol: evmSymbol,
    },
    block: header.number.toNumber(),
    blockTime: new Date(now.toNumber()).toISOString(),
    readAt: new Date().toISOString(),
  };
}
