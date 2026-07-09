from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.validation_models import ValidationResult
from app.reports.base_report_generator import BaseReportGenerator


class PdfReportGenerator(BaseReportGenerator[ValidationResult]):
    def generate(self, data: ValidationResult, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        styles = getSampleStyleSheet()
        title = ParagraphStyle("TitleLocal", parent=styles["Title"], textColor=colors.HexColor("#047857"), alignment=TA_CENTER)
        doc = SimpleDocTemplate(str(destination), pagesize=landscape(A4), rightMargin=12*mm, leftMargin=12*mm, topMargin=14*mm, bottomMargin=14*mm)
        story = [Paragraph("Procurement Validation Report", title), Spacer(1, 8*mm),
            Paragraph(f"<b>Project:</b> {escape(data.project_name)}", styles["BodyText"]),
            Paragraph(f"<b>Generated:</b> {escape(data.created_at)}", styles["BodyText"]),
            Paragraph(f"<b>Comparison mode:</b> {escape(data.mode.replace('_', ' ').title())}", styles["BodyText"]),
            Spacer(1, 6*mm)]
        summary = [["Rows reviewed", "Discrepancies", "High severity"], [str(data.total_rows), str(len(data.discrepancies)), str(sum(d.severity == "high" for d in data.discrepancies))]]
        table = Table(summary, colWidths=[70*mm]*3)
        table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#ECFDF5")),("TEXTCOLOR",(0,0),(-1,0),colors.HexColor("#065F46")),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("ALIGN",(0,0),(-1,-1),"CENTER"),("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#CBD5E1")),("PADDING",(0,0),(-1,-1),8)]))
        story.extend([table, Spacer(1, 8*mm), Paragraph("Issue breakdown", styles["Heading2"])])
        breakdown = [[key.replace("_", " ").title(), str(value)] for key, value in sorted(data.breakdown.items())] or [["No discrepancies", "0"]]
        story.append(Table(breakdown, colWidths=[90*mm,30*mm], style=[("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#CBD5E1")),("PADDING",(0,0),(-1,-1),6)]))
        story.extend([PageBreak(), Paragraph("Detailed discrepancies", styles["Heading1"]), Spacer(1, 4*mm)])
        rows = [["Issue", "Severity", "Source", "Location", "Reference", "Actual", "Suggested correction"]]
        for item in data.discrepancies:
            location = f"{item.comparison_sheet or item.reference_sheet or '-'} row {item.comparison_row or item.reference_row or '-'}"
            rows.append([item.issue_type.replace("_"," ").title(), item.severity.title(), item.source_file_name, location,
                item.expected_value or item.reference_description or "-", item.actual_value or item.comparison_description or "-", item.suggested_correction or item.notes or "Review item."])
        if len(rows) == 1: rows.append(["No discrepancies", "-", "-", "-", "-", "-", "No correction required."])
        detail = Table([[Paragraph(escape(str(cell)), styles["BodyText"]) for cell in row] for row in rows], repeatRows=1,
            colWidths=[30*mm,18*mm,38*mm,30*mm,52*mm,52*mm,55*mm])
        detail.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#047857")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("VALIGN",(0,0),(-1,-1),"TOP"),("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#CBD5E1")),("PADDING",(0,0),(-1,-1),4)]))
        story.append(detail)
        def footer(canvas, document):
            canvas.saveState(); canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.HexColor("#64748B"));
            canvas.drawString(12*mm, 8*mm, "Generated locally — original files were not modified.")
            canvas.drawRightString(landscape(A4)[0]-12*mm, 8*mm, f"Page {document.page}"); canvas.restoreState()
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return destination
