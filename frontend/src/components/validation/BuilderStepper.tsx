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
  const activeStepLabel = steps[activeIndex]?.label ?? "Current step";

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto p-2">
          <div className="grid min-w-[760px] gap-2 md:min-w-0 md:grid-cols-5">
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
                  className={`flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                    active ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${active ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</span>
                    <span className="block min-w-0 truncate text-sm font-semibold" title={step.label}>{step.label}</span>
                  </span>
                  {step.warning ? <span className="ml-auto size-2 rounded-full bg-amber-500" aria-label="Needs attention" title="Needs attention" /> : null}
                  {!step.warning && step.complete ? <span className="ml-auto size-2 rounded-full bg-emerald-600" aria-label="Complete" title="Complete" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="fixed bottom-4 right-4 left-[calc(var(--app-sidebar-offset,0px)+1rem)] z-40 transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 p-2 shadow-[0_18px_55px_rgba(15,23,42,0.16)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => previousStep && onStepChange(previousStep.id)}
            disabled={!previousStep}
            title={previousStep ? `Back to ${previousStep.label}` : "You are already on the first step"}
            aria-label={previousStep ? `Back to ${previousStep.label}` : "No previous step"}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          <div className="order-first min-w-0 rounded-2xl bg-slate-50 px-4 py-2 text-center sm:order-none">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400" title={`Current: ${activeStepLabel}`}>Current: {activeStepLabel}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-600" title={nextStep ? `Next: ${nextStep.label}` : "Final review step"}>
              {nextStep ? `Next: ${nextStep.label}` : "Final review step"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => nextStep && onStepChange(nextStep.id)}
            disabled={!nextStep}
            title={nextStep ? `Continue to ${nextStep.label}` : "You are already on the final step"}
            aria-label={nextStep ? `Continue to ${nextStep.label}` : "No next step"}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Next step
            <ArrowRight className="size-4" />
          </button>
        </div>
      </footer>
    </>
  );
}
