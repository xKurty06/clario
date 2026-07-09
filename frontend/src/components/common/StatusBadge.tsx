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
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

