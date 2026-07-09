import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";
import { WorkflowProvider } from "../features/files/WorkflowContext";

export function AppProviders({ children }: PropsWithChildren) {
  return <BrowserRouter><WorkflowProvider>{children}</WorkflowProvider></BrowserRouter>;
}
