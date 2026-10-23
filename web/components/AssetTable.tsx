import { connection } from "next/server";
import { getDirectory, type AssetRow, type SupplyCheck } from "@/lib/chain";
import { formatAmount, shortAddress } from "@/lib/portaldot";
import { AddToWallet } from "./AddToWallet";
import { CopyButton } from "./CopyButton";

const CHECK: Record<SupplyCheck, { label: string; className: string; title: string }> = {
  match: {
    label: "Match",
    className: "bg-success-bg text-success",
    title: "assets.asset(id).supply equals totalSupply() on the precompile",
  },
  mismatch: {
    label: "Mismatch",
    className: "bg-danger-bg text-danger",
    title: "Native supply and ERC-20 totalSupply() differ",
  },
  unreadable: {
    label: "No reply",
    className: "bg-warning-bg text-warning",
    title: "The precompile did not answer totalSupply()",
  },
};

const th = "px-3 py-2.5 text-left text-[12px] font-medium text-muted whitespace-nowrap";
const td = "px-3 py-3 align-middle whitespace-nowrap";

function Row({ a, sharedWith }: { a: AssetRow; sharedWith: number[] }) {
  const check = CHECK[a.check];
  return (
    <tr className="border-t border-border hover:bg-surface">
      <td className={`${td} num text-muted`}>{a.id}</td>
      <td className={td}>
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{a.symbol || "—"}</span>
          {sharedWith.length > 0 && (
            <span
              title={`Symbol also used by asset ${sharedWith.join(", ")}. Check the id before adding.`}
              className="rounded-[4px] bg-warning-bg px-1 text-[11px] font-medium text-warning"
            >
              Shared symbol
            </span>
          )}
        </div>
        <div className="max-w-[180px] truncate text-[12px] text-muted">{a.name || "No metadata"}</div>
      </td>
      <td className={td}>
        <span className="flex items-center gap-1">
          <span className="num text-[13px]" title={a.erc20}>
            {shortAddress(a.erc20)}
          </span>
          <CopyButton value={a.erc20} label={`Copy ${a.symbol} ERC-20 address`} />
        </span>
      </td>
      <td className={`${td} num text-right`}>{formatAmount(a.nativeSupply, a.decimals)}</td>
      <td className={`${td} num text-right`}>
        {a.evmSupply === null ? <span className="text-faint">—</span> : formatAmount(a.evmSupply, a.decimals)}
      </td>
      <td className={td}>
        <span title={check.title} className={`rounded-[4px] px-1.5 py-0.5 text-[12px] font-medium ${check.className}`}>
          {check.label}
        </span>
      </td>
      <td className={`${td} text-[13px]`}>{a.hasPool ? "tPOT pool" : <span className="text-faint">None</span>}</td>
      <td className={`${td} num text-right`}>{a.holders}</td>
      <td className={`${td} text-right`}>
        <AddToWallet address={a.erc20} symbol={a.symbol || `A${a.id}`} decimals={a.decimals} />
      </td>
    </tr>
  );
}

export async function AssetTable() {
  await connection();
  const dir = await getDirectory();
  const matched = dir.assets.filter((a) => a.check === "match").length;
  const bySymbol = new Map<string, number[]>();
  for (const a of dir.assets) if (a.symbol) bySymbol.set(a.symbol, [...(bySymbol.get(a.symbol) ?? []), a.id]);
  const sharedWith = (a: AssetRow) => (bySymbol.get(a.symbol) ?? []).filter((id) => id !== a.id);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em]">
          Native assets on testnet <span className="num text-muted">{dir.assets.length}</span>
        </h2>
        <p className="text-[12px] text-muted">
          Read at block <span className="num text-text">#{dir.block.toLocaleString("en-US")}</span> ·{" "}
          {matched}/{dir.assets.length} supplies agree across both sides
        </p>
      </div>
      <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full border-collapse text-[14px]">
          <thead className="bg-surface">
            <tr>
              <th className={th}>ID</th>
              <th className={th}>Token</th>
              <th className={th}>ERC-20 precompile</th>
              <th className={`${th} text-right`}>Native supply</th>
              <th className={`${th} text-right`}>totalSupply()</th>
              <th className={th}>Both sides</th>
              <th className={th}>Liquidity</th>
              <th className={`${th} text-right`}>Holders</th>
              <th className={th}>
                <span className="sr-only">Wallet</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dir.assets.map((a) => (
              <Row key={a.id} a={a} sharedWith={sharedWith(a)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AssetTableSkeleton() {
  return (
    <section aria-busy>
      <div className="h-7 w-64 rounded bg-surface-2" />
      <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-border">
        <div className="h-10 bg-surface" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-[57px] items-center gap-6 border-t border-border px-3">
            <div className="h-3 w-10 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
            <div className="h-3 w-44 rounded bg-surface-2" />
            <div className="ml-auto h-3 w-20 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">Reading pallet-assets and the precompile…</p>
    </section>
  );
}
