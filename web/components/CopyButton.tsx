"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex size-6 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-surface-2 hover:text-text"
    >
      {copied ? <Check size={14} strokeWidth={1.75} className="text-success" /> : <Copy size={14} strokeWidth={1.5} />}
    </button>
  );
}
