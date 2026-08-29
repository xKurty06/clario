import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReportExportPage } from "../pages/ReportExportPage";
import { SessionComparisonBuilderPage } from "../pages/SessionComparisonBuilderPage";
import { UploadFilesPage } from "../pages/UploadFilesPage";
import { ValidationResultsPage } from "../pages/ValidationResultsPage";
import { useWorkflow } from "../features/files/WorkflowContext";

function HomeRoute() {
  const { result, projectName, files } = useWorkflow();
  if (result) return <Navigate to="/results" replace />;
  if (projectName.trim() || files.length) return <Navigate to="/upload" replace />;
  return <DashboardPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeRoute />} />
        <Route path="upload" element={<UploadFilesPage />} />
        <Route path="mapping" element={<SessionComparisonBuilderPage />} />
        <Route path="preview" element={<Navigate to="/mapping" replace />} />
        <Route path="results" element={<ValidationResultsPage />} />
        <Route path="reports" element={<ReportExportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
