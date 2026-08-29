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

const supplementalTips: Record<string, string> = {
  "Give this review a clear name. The same name is used in the validation result and PDF report.": "Use a name you can recognize later when reviewing results or exported PDFs.",
  "The preset only creates a starting structure. You can still customize sources, rows, fields, and rules later.": "Choose the closest starting point. You can still adjust the setup before validation.",
  "Choose the Excel or CSV files you want to inspect. The app reads a temporary local copy and does not modify the originals.": "Only local copies are read for comparison. Your original spreadsheets stay unchanged.",
  "A friendly name used in rules and reports. This does not rename the original file.": "Use a role-based name like Reference, Bidder, or Abstract so results are easier to read.",
  "Choose the uploaded workbook or CSV this source will read from.": "Pick the file that belongs to this source role.",
  "Choose the worksheet tab that contains the rows you want to compare.": "Select the tab with the actual table, not a cover or summary sheet.",
  "The Excel row where column labels are located.": "Check this carefully when the sheet has titles, merged cells, or notes above the table.",
  "The first row that contains real data. Rows above this are skipped.": "This should be the first item row, not a repeated header, section label, subtotal, or blank row.",
  "The name used in rules and reports, such as Quantity, Unit Cost, or Brand.": "Use the same field name across sources when those columns should be compared together.",
  "Controls how values are normalized and compared.": "Choose text, number, or currency so the app compares values using the right logic.",
  "Flags selected rows where this field is blank.": "Turn this off only when blanks are acceptable for this column or the field is optional.",
  "The spreadsheet column where this value comes from. Column letters are used so mapping still works with unclear or duplicate headers.": "Use the column letter when headers are merged, duplicated, or not reliable.",
  "Treat uppercase and lowercase text as equal during comparison.": "Useful when capitalization differences should not be reported, such as ITEM A vs item a.",
  "Remove extra spaces at the start and end.": "Use this for copied spreadsheet values that may contain accidental leading or trailing spaces.",
  "Treat repeated spaces and line breaks as one space.": "Use this when wrapped cell text or double spaces should not create a mismatch.",
  "A readable name for this check in the results and PDF report.": "Use a short name that clearly describes what issue this rule will detect.",
  "Controls how important this issue appears in results.": "Use higher severity for findings that should stand out in the report.",
  "Disabled rules are saved but skipped during validation.": "Turn this off to keep the rule for later without deleting it.",
  "Choose the kind of validation to perform.": "Pick whether this rule compares values, checks blanks, finds duplicates, or validates a formula.",
  "The trusted value or formula source.": "Usually this is the reference or expected side of the comparison.",
  "The value being checked against the expected value.": "Usually this is the copied, bidder, or target side being checked.",
  "Choose the formula operator used to derive the expected result.": "Use this when one field should be calculated from two other fields.",
  "Controls how rows from different sources are paired before comparison.": "Wrong row pairing can create false discrepancies, so choose this carefully.",
  "Controls how exact the values must be.": "Use exact matching for strict text checks and tolerance for numbers or currency.",
  "Allowed numeric difference before this rule reports a mismatch.": "Set a small allowance when rounding or decimal precision may differ.",
  "Allowed currency difference before this rule reports a mismatch.": "Set a small allowance for centavo-level rounding differences.",
};

function getSupplementalTip(text: string) {
  return supplementalTips[text] ?? `Extra guidance: ${text}`;
}

export function HelpTip({ text }: HelpTipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipText = getSupplementalTip(text);

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
      {tooltipText}
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
      <span className="help-tip-trigger grid size-5 place-items-center rounded-full text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
        <CircleHelp className="size-3.5" />
      </span>
      {tooltip}
    </span>
  );
}
