import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { ReportExportPage } from "../pages/ReportExportPage";
import { TemplateManagerPage } from "../pages/TemplateManagerPage";
import { TemplateMappingPage } from "../pages/TemplateMappingPage";
import { UploadFilesPage } from "../pages/UploadFilesPage";
import { ValidationResultsPage } from "../pages/ValidationResultsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="upload" element={<UploadFilesPage />} />
        <Route path="mapping" element={<TemplateMappingPage />} />
        <Route path="preview" element={<Navigate to="/mapping" replace />} />
        <Route path="results" element={<ValidationResultsPage />} />
        <Route path="reports" element={<ReportExportPage />} />
        <Route path="templates" element={<TemplateManagerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
