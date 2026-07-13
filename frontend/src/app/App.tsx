import { useEffect } from "react";
import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";

export function App() {
  useEffect(() => {
    const blurFocusedNumberInputOnWheel = (event: WheelEvent) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement) || activeElement.type !== "number") return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest('input[type="number"]') !== activeElement) return;
      activeElement.blur();
    };

    document.addEventListener("wheel", blurFocusedNumberInputOnWheel, { capture: true });
    return () => document.removeEventListener("wheel", blurFocusedNumberInputOnWheel, { capture: true });
  }, []);

  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
