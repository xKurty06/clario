import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error";

interface ToastNotification {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, tone: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles = {
  success: {
    icon: CheckCircle2,
    container: "border-emerald-200 text-emerald-800",
    progress: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    container: "border-red-200 text-red-800",
    progress: "bg-red-500",
  },
} satisfies Record<ToastTone, { icon: typeof CheckCircle2; container: string; progress: string }>;

function ToastItem({ notification, onRemove }: { notification: ToastNotification; onRemove: () => void }) {
  const [exiting, setExiting] = useState(false);
  const style = toneStyles[notification.tone];
  const Icon = style.icon;

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onRemove, 220);
  };

  useEffect(() => {
    const timeout = window.setTimeout(dismiss, notification.duration);
    return () => window.clearTimeout(timeout);
  }, [notification.duration]);

  return (
    <div
      className={`relative flex shrink-0 items-start gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg shadow-slate-900/10 ${style.container} ${exiting ? "toast-exit" : ""}`}
      role={notification.tone === "error" ? "alert" : "status"}
      aria-live={notification.tone === "error" ? "assertive" : "polite"}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1">{notification.message}</span>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 grid size-5 shrink-0 place-items-center rounded text-current/60 transition hover:bg-slate-100 hover:text-current focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
        aria-label="Dismiss notification"
        title="Dismiss notification"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
      <span aria-hidden="true" className={`toast-progress absolute inset-x-0 bottom-0 h-px ${style.progress}`} />
    </div>
  );
}

function ToastViewport({ notifications, onRemove }: { notifications: ToastNotification[]; onRemove: (id: number) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const updateOverflow = () => setIsOverflowing(content.scrollHeight > viewport.clientHeight + 1);
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [notifications.length]);

  return (
    <div ref={viewportRef} className={`toast-viewport fixed bottom-5 right-5 z-50 flex max-h-[33vh] w-[min(22rem,calc(100vw-2rem))] flex-col justify-end gap-2 overflow-hidden ${isOverflowing ? "toast-viewport--overflowing" : ""}`} aria-label="Notifications">
      <div ref={contentRef} className="flex flex-col gap-2">
        {notifications.map((notification) => (
          <ToastItem key={notification.id} notification={notification} onRemove={() => onRemove(notification.id)} />
        ))}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showToast = (message: string, tone: ToastTone) => {
    const id = nextId.current++;
    setNotifications((current) => [{ id, message, tone, duration: 4000 }, ...current]);
  };

  const removeToast = (id: number) => setNotifications((current) => current.filter((notification) => notification.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport notifications={notifications} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}