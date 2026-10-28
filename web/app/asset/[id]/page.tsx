import { ArrowLeft, Check, Minus, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AddToWallet } from "@/components/AddToWallet";
import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";
import { getAsset, type AssetDetail } from "@/lib/chain";
import { EVM_RPC, formatAmount, shortAddress } from "@/lib/portaldot";

export const metadata: Metadata = { title: "Asset — Twofold" };

export default function AssetPage(props: PageProps<"/asset/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
          <ArrowLeft size={14} strokeWidth={1.5} />
          All assets
        </Link>
        <Suspense fallback={<Skeleton />}>
          <Detail params={props.params} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  if (!/^\d{1,10}$/.test(raw) || Number(raw) > 0xffffffff) notFound();
  const a = await getAsset(Number(raw));
  if (!a) notFound();

  const lagSeconds = Math.max(0, (Date.parse(a.readAt) - Date.parse(a.blockTime)) / 1000);
  return (
    <>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            {a.symbol || `Asset ${a.id}`}
            <span className="ml-3 text-[20px] font-normal text-muted">{a.name || "No metadata"}</span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span>
              Native id <span className="num text-text">{a.id}</span>
            </span>
            <span>
              Status <span className="text-text">{a.status}</span>
            </span>
            <span>{a.hasPool ? "tPOT pool exists" : "No pool"}</span>
            {lagSeconds > 120 && <span className="text-warning">Chain not producing blocks; showing last state</span>}
          </p>
        </div>
        <AddToWallet address={a.erc20} symbol={a.symbol || `A${a.id}`} decimals={a.decimals} long />
      </div>

      <Faces a={a} />
      <Use a={a} />
    </>
  );
}

type Verdict = "match" | "mismatch" | "missing";

function VerdictCell({ v, note }: { v: Verdict; note?: string }) {
  const map = {
    match: { Icon: Check, text: "Match", cls: "text-success" },
    mismatch: { Icon: X, text: "Mismatch", cls: "text-danger" },
    missing: { Icon: Minus, text: note ?? "Not exposed", cls: "text-muted" },
  }[v];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${map.cls}`}>
      <map.Icon size={14} strokeWidth={1.75} aria-hidden />
      {map.text}
    </span>
  );
}

function MobileMark({ v }: { v: Verdict }) {
  if (v === "match") return <Check size={14} strokeWidth={1.75} className="text-success" aria-label="Match" />;
  if (v === "mismatch") return <X size={14} strokeWidth={1.75} className="text-danger" aria-label="Mismatch" />;
  return <Minus size={14} strokeWidth={1.75} className="text-muted" aria-label="Not available" />;
}

function Faces({ a }: { a: AssetDetail }) {
  const dec = a.decimals;
  const noMetadata = !a.symbol && !a.name;
  const supplyVerdict: Verdict =
    a.evm.totalSupply === null ? "missing" : a.evm.totalSupply === a.native.supply ? "match" : "mismatch";
  const decVerdict: Verdict = a.evm.decimals === null ? "missing" : a.evm.decimals === dec ? "match" : "mismatch";
  const textVerdict = (native: string, evm: string | null): Verdict =>
    evm === null || evm === "" ? "missing" : evm === native ? "match" : "mismatch";

  const rows: { label: string; native: ReactNode; evm: ReactNode; v: Verdict; note?: string }[] = [
    {
      label: "Total supply",
      native: formatAmount(a.native.supply, dec, dec),
      evm: a.evm.totalSupply === null ? "—" : formatAmount(a.evm.totalSupply, dec, dec),
      v: supplyVerdict,
      note: "No reply",
    },
    {
      label: "Decimals",
      native: noMetadata ? "—" : dec,
      evm: a.evm.decimals ?? "—",
      v: noMetadata ? "missing" : decVerdict,
      note: noMetadata ? "No metadata" : "No reply",
    },
    { label: "Symbol", native: a.symbol || "—", evm: a.evm.symbol || "—", v: textVerdict(a.symbol, a.evm.symbol) },
    { label: "Name", native: a.name || "—", evm: a.evm.name || "—", v: textVerdict(a.name, a.evm.name) },
  ];

  const th = "px-3 py-2.5 text-left text-[12px] font-medium text-muted whitespace-nowrap";
  const td = "px-3 py-3 whitespace-nowrap";
  return (
    <section className="mt-8">
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em]">One asset, two views</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-muted">
        The left column reads <span className="num">pallet-assets</span> storage over the node websocket. The right
        column calls the ERC-20 precompile over eth-rpc. Two different paths into the same state.
      </p>
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full border-collapse">
          <thead className="bg-surface">
            <tr>
              <th className={th}></th>
              <th className={th}>Native (pallet-assets)</th>
              <th className={th}>ERC-20 (precompile)</th>
              <th className={th}>Both sides</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className={`${td} text-muted`}>
                  <span className="inline-flex items-center gap-1.5">
                    {r.label}
                    <span className="sm:hidden">
                      <MobileMark v={r.v} />
                    </span>
                  </span>
                </td>
                <td className={`${td} num`}>{r.native}</td>
                <td className={`${td} num`}>{r.evm}</td>
                <td className={td}>
                  <VerdictCell v={r.v} note={r.note} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className={`${td} text-muted`}>Address</td>
              <td className={`${td} text-faint`}>—</td>
              <td className={td} colSpan={2}>
                <span className="flex items-center gap-1">
                  <span className="num break-all text-[13px]">{a.erc20}</span>
                  <CopyButton value={a.erc20} label="Copy ERC-20 address" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["Owner", a.native.owner],
            ["Issuer", a.native.issuer],
            ["Admin", a.native.admin],
            ["Freezer", a.native.freezer],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted">{k}</dt>
            <dd className="flex items-center gap-1">
              <span className="num" title={v}>
                {shortAddress(v, 8, 6)}
              </span>
              <CopyButton value={v} label={`Copy ${k} address`} />
            </dd>
          </div>
        ))}
        <Fact label="Holders" value={String(a.native.accounts)} />
        <Fact label="Minimum balance" value={formatAmount(a.native.minBalance, dec, dec)} />
        <Fact label="Self-sufficient" value={a.isSufficient ? "Yes" : "No, holders need tPOT"} mono={false} />
      </dl>
    </section>
  );
}

function Fact({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "num" : ""}>{value}</dd>
    </div>
  );
}

function Use({ a }: { a: AssetDetail }) {
  const label = a.symbol || `asset ${a.id}`;
  const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Example {
    // ${label}: native asset ${a.id}
    IERC20 public constant TOKEN = IERC20(${a.erc20});

    function pull(uint256 amount) external {
        TOKEN.transferFrom(msg.sender, address(this), amount);
    }
}`;
  const viem = `import { createPublicClient, erc20Abi, http } from "viem";

const client = createPublicClient({ transport: http("${EVM_RPC}") });

const supply = await client.readContract({
  address: "${a.erc20}", // ${label}
  abi: erc20Abi,
  functionName: "totalSupply",
});`;

  return (
    <section className="mt-10">
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em]">Use it from the EVM</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-muted">
        No wrapper contract and no bridge. Treat the address as any ERC-20.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CodeBlock title="Solidity" code={solidity} />
        <CodeBlock title="viem" code={viem} />
      </div>
      {!a.isSufficient && (
        <p className="mt-4 max-w-2xl rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 text-[13px] text-muted">
          <span className="font-medium text-text">Before you send it to a new address:</span> this asset is not
          self-sufficient, so a recipient with no tPOT cannot hold it. In our end-to-end run a transfer to fresh
          addresses reverted until each held 0.2 tPOT.
        </p>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="mt-6">
      <div className="h-9 w-72 rounded bg-surface-2" />
      <div className="mt-8 h-56 rounded-[var(--radius-card)] border border-border bg-surface" />
      <p className="mt-3 text-[12px] text-muted">Reading both sides of the asset…</p>
    </div>
  );
}
