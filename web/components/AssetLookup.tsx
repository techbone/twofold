"use client";

import { useMemo, useState } from "react";
import { assetIdFromAddress, erc20Address } from "@/lib/portaldot";
import { CopyButton } from "./CopyButton";

export function AssetLookup() {
  const [input, setInput] = useState("7777");

  const result = useMemo((): { error: string } | { id: number; address: string } | null => {
    const v = input.trim();
    if (!v) return null;
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) {
      const id = assetIdFromAddress(v);
      return id === null
        ? { error: "Not an assets precompile address." }
        : { id, address: erc20Address(id) };
    }
    if (/^\d+$/.test(v) && Number(v) <= 0xffffffff) return { id: Number(v), address: erc20Address(Number(v)) };
    return { error: "Enter an asset id (u32) or a 0x address." };
  }, [input]);

  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5">
      <label htmlFor="asset" className="text-[12px] font-medium text-muted">
        Asset id or ERC-20 address
      </label>
      <input
        id="asset"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="num mt-2 h-9 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 text-[13px] outline-none focus:border-accent"
      />
      <div className="mt-4 min-h-[52px]">
        {result && "error" in result && <p className="text-[13px] text-danger">{result.error}</p>}
        {result && "address" in result && (
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-y-2 text-[13px]">
            <dt className="text-muted">Native id</dt>
            <dd className="num">{result.id}</dd>
            <dt className="text-muted">ERC-20</dt>
            <dd className="flex min-w-0 items-start gap-1">
              <span className="num break-all text-[12px] leading-5">{result.address}</span>
              <CopyButton value={result.address} label="Copy ERC-20 address" />
            </dd>
          </dl>
        )}
      </div>
      <p className="num mt-3 border-t border-border pt-3 text-[11px] text-faint">
        id (u32) ‖ 00×12 ‖ 0001 ‖ 0000
      </p>
    </div>
  );
}
