import { Check, Loader2, Minus, X } from "lucide-react";

export type StepState = "todo" | "active" | "done" | "error";
export type Step = { key: string; label: string; state: StepState; detail?: string };

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-5 space-y-3" aria-live="polite">
      {steps.map((s) => (
        <li key={s.key} className="flex items-start gap-2.5 text-[13px]">
          <span className="mt-0.5 shrink-0">
            {s.state === "done" && <Check size={15} strokeWidth={1.75} className="text-success" />}
            {s.state === "active" && <Loader2 size={15} strokeWidth={1.5} className="animate-spin text-muted" />}
            {s.state === "error" && <X size={15} strokeWidth={1.75} className="text-danger" />}
            {s.state === "todo" && <Minus size={15} strokeWidth={1.5} className="text-faint" />}
          </span>
          <span className="min-w-0">
            <span className={s.state === "todo" ? "text-faint" : ""}>{s.label}</span>
            {s.detail && (
              <span className={`num mt-0.5 block break-all text-[12px] ${s.state === "error" ? "text-danger" : "text-muted"}`}>
                {s.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
