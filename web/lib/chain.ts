import "@polkadot/api-augment";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { cacheLife } from "next/cache";
import { createPublicClient, erc20Abi, http } from "viem";
import { erc20Address, portaldot, SUBSTRATE_WS } from "./portaldot";

let apiPromise: Promise<ApiPromise> | undefined;

function substrate(): Promise<ApiPromise> {
  apiPromise ??= ApiPromise.create({ provider: new WsProvider(SUBSTRATE_WS), noInitWarn: true });
  return apiPromise;
}

const evm = createPublicClient({ chain: portaldot, transport: http() });

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

export type Directory = { block: number; readAt: string; assets: AssetRow[] };

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
  cacheLife({ stale: 15, revalidate: 15, expire: 120 });

  const api = await substrate();
  const [details, metadata, poolKeys, header] = await Promise.all([
    api.query.assets.asset.entries(),
    api.query.assets.metadata.entries(),
    api.query.assetConversion.pools.keys(),
    api.rpc.chain.getHeader(),
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
        const evmSupply = await evm
          .readContract({ address: erc20, abi: erc20Abi, functionName: "totalSupply" })
          .catch(() => null);
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
  return { block: header.number.toNumber(), readAt: new Date().toISOString(), assets };
}
