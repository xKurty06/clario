import type { LucideIcon } from "lucide-react";

export interface BuilderStep {
  id: string;
  label: string;
  icon: LucideIcon;
  complete?: boolean;
  warning?: boolean;
}

interface BuilderStepperProps {
  steps: BuilderStep[];
  activeStep: string;
  onStepChange: (step: string) => void;
}

export function BuilderStepper({ steps, activeStep, onStepChange }: BuilderStepperProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
      <div className="grid min-w-[920px] gap-2 lg:min-w-0 lg:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${
                active ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${active ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</span>
                <span className="block truncate text-sm font-semibold">{step.label}</span>
              </span>
              {step.warning ? <span className="ml-auto size-2 rounded-full bg-amber-500" aria-label="Needs attention" /> : null}
              {!step.warning && step.complete ? <span className="ml-auto size-2 rounded-full bg-emerald-600" aria-label="Complete" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
