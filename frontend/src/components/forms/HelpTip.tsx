import { CircleHelp } from "lucide-react";

interface HelpTipProps {
  text: string;
}

export function HelpTip({ text }: HelpTipProps) {
  return (
    <span className="group/help relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Help: ${text}`}
        className="grid size-5 place-items-center rounded-full text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:bg-emerald-50 focus-visible:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
      >
        <CircleHelp aria-hidden="true" className="size-3.5" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[70] w-64 -translate-x-1/2 translate-y-1 rounded-xl bg-slate-900 px-3 py-2.5 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-xl transition-all duration-150 group-hover/help:translate-y-0 group-hover/help:opacity-100 group-focus-within/help:translate-y-0 group-focus-within/help:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  );
}

