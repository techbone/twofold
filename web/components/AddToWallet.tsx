"use client";

import { Wallet } from "lucide-react";
import { useState } from "react";
import { ensurePortaldot, getWallet } from "./wallet";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string };

export function AddToWallet({
  address,
  symbol,
  decimals,
  long = false,
}: {
  address: string;
  symbol: string;
  decimals: number;
  long?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function add() {
    setState({ kind: "busy" });
    try {
      const wallet = getWallet();
      await ensurePortaldot(wallet);
      const added = await wallet.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: { address, symbol: symbol.slice(0, 11), decimals } },
      });
      setState(added ? { kind: "done" } : { kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={state.kind === "busy"}
      title={state.kind === "error" ? state.message : "Add to MetaMask"}
      className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-2 text-[12px] text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60"
    >
      <Wallet size={13} strokeWidth={1.5} />
      {state.kind === "done" ? "Added" : state.kind === "busy" ? "Confirm…" : state.kind === "error" ? "Retry" : long ? "Add to MetaMask" : "Add"}
    </button>
  );
}
