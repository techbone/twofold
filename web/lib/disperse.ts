import { getAddress, hexToBytes, isAddress, parseAbi, type Address } from "viem";
import { parseAmount } from "./client-chain";

/** Disperse on Portaldot V3 testnet. Deploy tx and block are in docs/evidence/deployments.json. */
export const DISPERSE_ADDRESS: Address = "0x389a5f1e3897a3cad547af7d872a174f5d22205c";

export const disperseAbi = parseAbi([
  "function disperseAsset(uint32 assetId, address[] to, uint256[] amounts)",
  "event Dispersed(address indexed token, address indexed sender, uint256 recipients, uint256 total)",
  "error LengthMismatch()",
  "error TransferFailed(address to, uint256 amount)",
]);

export const MAX_RECIPIENTS = 100;

/** Enough tPOT for a recipient to hold a non-sufficient asset. 0.2 worked in the e2e run. In eth-rpc units (18 decimals). */
export const FUND_VALUE = 2n * 10n ** 17n;

export type Row = { line: number; to: Address; amount: bigint };

/** One "address, amount" pair per line. Commas, spaces, tabs, = and ; all work as separators. */
export function parseRecipients(input: string, decimals: number): { rows: Row[]; errors: string[] } {
  const rows: Row[] = [];
  const errors: string[] = [];
  input.split(/\r?\n/).forEach((text, i) => {
    const line = text.trim();
    if (!line || line.startsWith("#") || (i === 0 && /^address/i.test(line))) return;
    const n = i + 1;
    const parts = line.split(/[\s,;=]+/).filter(Boolean);
    if (parts.length !== 2) return void errors.push(`Line ${n}: expected an address and an amount.`);
    const [addr, amt] = parts;
    if (!isAddress(addr)) return void errors.push(`Line ${n}: ${addr.slice(0, 14)}… is not a valid 0x address.`);
    const amount = parseAmount(amt, decimals);
    if (amount === null || amount === 0n) {
      return void errors.push(`Line ${n}: amount must be a positive number with at most ${decimals} decimals.`);
    }
    rows.push({ line: n, to: getAddress(addr), amount });
  });
  if (rows.length > MAX_RECIPIENTS) errors.push(`At most ${MAX_RECIPIENTS} recipients per payout.`);
  return { rows, errors };
}

/** Native account behind an EVM address: h160 ‖ 0xEE×12. */
export function nativeKey(address: Address): Uint8Array {
  const out = new Uint8Array(32).fill(0xee);
  out.set(hexToBytes(address), 0);
  return out;
}
