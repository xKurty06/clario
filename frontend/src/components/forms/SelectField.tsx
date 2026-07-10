import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectFieldProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  compact?: boolean;
  helpText?: string;
}

export function SelectField({ value, options, onChange, ariaLabel, className = "", compact = false, helpText }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
  }, [options, value]);

  const choose = (option: SelectOption) => {
    if (option.value !== value) {
      onChange(option.value);
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={helpText ?? `Choose ${ariaLabel.toLowerCase()}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            if (!open) setOpen(true);
            setActiveIndex((current) => (current + direction + options.length) % options.length);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const option = options[activeIndex];
            if (option) choose(option);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white text-left text-slate-800 outline-none transition duration-200 hover:border-slate-400 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-100 ${open ? "border-emerald-600 ring-3 ring-emerald-100" : "border-slate-300"} ${compact ? "min-h-9 px-3 py-2 text-xs" : "min-h-11 px-3.5 py-2.5 text-sm"}`}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{selected?.label ?? "Select an option"}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
      </button>

      {open && (
        <div id={listboxId} role="listbox" aria-label={ariaLabel} className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                title={option.description ?? `Choose ${option.label}`}
                key={option.value}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 ${compact ? "text-xs" : "text-sm"} ${isSelected ? "bg-emerald-50 font-semibold text-emerald-800" : isActive ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-100"}`}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">{option.label}</span>
                <Check aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-emerald-700 ${isSelected ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
