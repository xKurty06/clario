import { LayoutTemplate } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/layout/PageHeader";

/** Reserved for a future release. Templates are not part of the current workflow. */
export function TemplateManagerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Future"
        title="Templates"
        description="Reusable validation templates are reserved for a future version of Clario."
      />
      <div className="pt-8">
        <EmptyState
          icon={LayoutTemplate}
          title="Not available in this release"
          description="The current workflow is intentionally configured directly from uploaded files, fields, and rules."
        />
      </div>
    </div>
  );
}
