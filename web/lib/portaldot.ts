import { defineChain, getAddress, type Address } from "viem";

export const SUBSTRATE_WS = "wss://test-node-v3.portaldot.dev";
export const EVM_RPC = "https://test-evm-rpc-v3.portaldot.dev";
export const CHAIN_ID = 420420777;
export const NATIVE_DECIMALS = 14;

export const portaldot = defineChain({
  id: CHAIN_ID,
  name: "Portaldot V3 Testnet",
  nativeCurrency: { name: "Portaldot", symbol: "tPOT", decimals: 18 },
  rpcUrls: { default: { http: [EVM_RPC] } },
});

/**
 * ERC-20 precompile address of a pallet-assets asset.
 * Layout: asset id (u32 BE) ‖ 12 zero bytes ‖ 0x0001 ‖ 0x0000.
 * Verified on testnet: pUSD (7777) → 0x00001E6100000000000000000000000000010000.
 */
export function erc20Address(assetId: number): Address {
  if (!Number.isInteger(assetId) || assetId < 0 || assetId > 0xffffffff) {
    throw new RangeError(`asset id must be a u32, got ${assetId}`);
  }
  const id = assetId.toString(16).padStart(8, "0");
  return getAddress(`0x${id}${"0".repeat(24)}00010000`);
}

export function assetIdFromAddress(address: string): number | null {
  const hex = address.toLowerCase().replace(/^0x/, "");
  if (hex.length !== 40 || !hex.endsWith(`${"0".repeat(24)}00010000`)) return null;
  return parseInt(hex.slice(0, 8), 16);
}

export function shortAddress(address: string, head = 10, tail = 8): string {
  const a = address.toLowerCase();
  return a.length <= head + tail ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function formatAmount(raw: string | bigint, decimals: number, maxFraction = 2): string {
  const v = BigInt(raw);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = decimals === 0 ? "" : frac.toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fracStr ? `.${fracStr}` : ""}`;
}
