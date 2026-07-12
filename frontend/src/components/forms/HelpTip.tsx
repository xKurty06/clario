import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

interface HelpTipProps {
  text: string;
}

interface TooltipPosition {
  placement: "top" | "bottom";
  left: number;
  top?: number;
  bottom?: number;
  arrowLeft: number;
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_GAP = 10;
const VIEWPORT_MARGIN = 12;

export function HelpTip({ text }: HelpTipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const triggerCenter = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, triggerCenter - TOOLTIP_WIDTH / 2),
      Math.max(VIEWPORT_MARGIN, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN),
    );
    const arrowLeft = Math.min(
      Math.max(14, triggerCenter - left),
      TOOLTIP_WIDTH - 14,
    );
    const aboveSpace = rect.top - TOOLTIP_GAP;
    const belowSpace = viewportHeight - rect.bottom - TOOLTIP_GAP;
    const placement = aboveSpace >= 96 || aboveSpace >= belowSpace ? "top" : "bottom";

    setPosition({
      placement,
      left,
      arrowLeft,
      top: placement === "bottom" ? rect.bottom + TOOLTIP_GAP : undefined,
      bottom: placement === "top" ? viewportHeight - rect.top + TOOLTIP_GAP : undefined,
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      setPosition(null);
      return undefined;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible, updatePosition]);

  const tooltipStyle: CSSProperties | undefined = position
    ? {
        left: position.left,
        width: TOOLTIP_WIDTH,
        ...(position.placement === "top" ? { bottom: position.bottom } : { top: position.top }),
      }
    : undefined;

  const arrowStyle: CSSProperties | undefined = position
    ? { left: position.arrowLeft }
    : undefined;

  const tooltip = visible && position && typeof document !== "undefined" ? createPortal(
    <span
      role="tooltip"
      style={tooltipStyle}
      className="pointer-events-none fixed z-[130] rounded-xl bg-slate-900 px-3 py-2.5 text-left text-xs font-normal leading-5 text-white opacity-0 shadow-xl animate-[builder-dialog-in_120ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
    >
      {text}
      <span
        aria-hidden="true"
        style={arrowStyle}
        className={`absolute -translate-x-1/2 border-4 border-transparent ${position.placement === "top" ? "top-full border-t-slate-900" : "bottom-full border-b-slate-900"}`}
      />
    </span>,
    document.body,
  ) : null;

  return (
    <span
      ref={triggerRef}
      className="help-tip inline-flex align-middle"
      aria-hidden="true"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="grid size-5 place-items-center rounded-full text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700">
        <CircleHelp className="size-3.5" />
      </span>
      {tooltip}
    </span>
  );
}
