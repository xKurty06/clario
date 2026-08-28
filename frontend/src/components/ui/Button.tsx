import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900",
  secondary: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300",
  danger: "border-transparent bg-red-700 text-white hover:bg-red-800 active:bg-red-900",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200",
  outline: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-lg px-3 py-1.5 text-xs",
  md: "min-h-10 rounded-xl px-4 py-2 text-sm",
  lg: "min-h-11 rounded-xl px-5 py-2.5 text-base",
};

export function Button({ variant = "primary", size = "md", loading = false, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 border font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
      {children}
    </button>
  );
}
