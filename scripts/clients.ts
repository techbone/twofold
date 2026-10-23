import "@polkadot/api-augment";
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { encodeAddress } from "@polkadot/util-crypto";
import { hexToU8a, u8aConcat } from "@polkadot/util";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID, EVM_RPC, SUBSTRATE_WS } from "../web/lib/portaldot.ts";

// Rebuilt with this package's viem so the types line up with the clients below.
const portaldot = defineChain({
  id: CHAIN_ID,
  name: "Portaldot V3 Testnet",
  nativeCurrency: { name: "Portaldot", symbol: "tPOT", decimals: 18 },
  rpcUrls: { default: { http: [EVM_RPC] } },
});

export const TPOT = 10n ** 14n;

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name} in .env`);
  return v;
}

export async function connect() {
  const api = await ApiPromise.create({ provider: new WsProvider(SUBSTRATE_WS), noInitWarn: true });
  const issuer = new Keyring({ type: "sr25519", ss58Format: 42 }).addFromUri(need("ISSUER_MNEMONIC"));
  const deployer = privateKeyToAccount(need("DEPLOYER_PRIVATE_KEY") as Hex);
  const evm = createPublicClient({ chain: portaldot, transport: http() });
  const wallet = createWalletClient({ chain: portaldot, transport: http(), account: deployer });
  return { api, issuer, deployer, evm, wallet };
}

/** Native account behind an EVM address: h160 ‖ 0xEE×12 (pallet-revive fallback). */
export function fallbackAccount(evmAddress: string): string {
  return encodeAddress(u8aConcat(hexToU8a(evmAddress), new Uint8Array(12).fill(0xee)), 42);
}

export async function nativeFree(api: ApiPromise, who: string): Promise<bigint> {
  return (await api.query.system.account(who)).data.free.toBigInt();
}

/** Sign, submit and wait until in block; throws on dispatch error. Returns block + extrinsic hash. */
export function send(
  api: ApiPromise,
  tx: SubmittableExtrinsic<"promise">,
  signer: Parameters<SubmittableExtrinsic<"promise">["signAndSend"]>[0],
): Promise<{ block: string; hash: string }> {
  return new Promise((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError, txHash }) => {
      if (dispatchError) {
        const msg = dispatchError.isModule
          ? (({ section, name }) => `${section}.${name}`)(api.registry.findMetaError(dispatchError.asModule))
          : dispatchError.toString();
        reject(new Error(msg));
      } else if (status.isInBlock) {
        resolve({ block: status.asInBlock.toHex(), hash: txHash.toHex() });
      }
    }).catch(reject);
  });
}

export const fmt = (v: bigint, decimals: number) => {
  const s = v.toString().padStart(decimals + 1, "0");
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
};
