interface StatusBadgeProps {
  children: string;
  tone?: "neutral" | "success" | "warning";
}

const toneClass = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5 ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
