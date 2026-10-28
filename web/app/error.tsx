"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-3 px-4 py-24 sm:px-6">
      <h1 className="font-display text-[20px] font-semibold tracking-[-0.01em]">Couldn&apos;t reach the Portaldot testnet</h1>
      <p className="max-w-md text-[14px] text-muted">
        The node or the eth-rpc endpoint didn&apos;t answer in time. Nothing is wrong with your wallet or tokens.
      </p>
      <button
        type="button"
        onClick={reset}
        className="h-8 rounded-[var(--radius-control)] bg-accent px-3 text-[13px] font-medium text-accent-fg"
      >
        Try again
      </button>
    </div>
  );
}
