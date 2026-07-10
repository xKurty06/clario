import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const previousStep = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const nextStep = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto p-2">
        <div className="grid min-w-[920px] gap-2 lg:min-w-0 lg:grid-cols-5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = step.id === activeStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepChange(step.id)}
                title={`Go to ${step.label}`}
                aria-label={`Go to step ${index + 1}: ${step.label}`}
                className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
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
                {step.warning ? <span className="ml-auto size-2 rounded-full bg-amber-500" aria-label="Needs attention" title="Needs attention" /> : null}
                {!step.warning && step.complete ? <span className="ml-auto size-2 rounded-full bg-emerald-600" aria-label="Complete" title="Complete" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => previousStep && onStepChange(previousStep.id)}
          disabled={!previousStep}
          title={previousStep ? `Back to ${previousStep.label}` : "You are already on the first step"}
          aria-label={previousStep ? `Back to ${previousStep.label}` : "No previous step"}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <p className="order-first text-center text-xs text-slate-500 sm:order-none">
          {nextStep ? `Next: ${nextStep.label}` : "You are on the final review step."}
        </p>

        <button
          type="button"
          onClick={() => nextStep && onStepChange(nextStep.id)}
          disabled={!nextStep}
          title={nextStep ? `Continue to ${nextStep.label}` : "You are already on the final step"}
          aria-label={nextStep ? `Continue to ${nextStep.label}` : "No next step"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Next step
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
