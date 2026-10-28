import { CopyButton } from "./CopyButton";

export function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border pl-3 pr-1.5">
        <span className="text-[12px] font-medium text-muted">{title}</span>
        <CopyButton value={code} label={`Copy ${title} snippet`} />
      </div>
      <pre className="num overflow-x-auto p-3 text-[12px] leading-[1.65]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
