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
        doc = SimpleDocTemplate(str(destination), pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm, topMargin=12 * mm, bottomMargin=12 * mm)
        story = [
            Paragraph("Comparison Builder Validation Report", title),
            Spacer(1, 7 * mm),
            Paragraph(f"<b>Project:</b> {escape(data.project_name)}", styles["BodyText"]),
            Paragraph(f"<b>Generated:</b> {escape(data.created_at)}", styles["BodyText"]),
            Paragraph(f"<b>Preset:</b> {escape(data.preset.replace('_', ' ').title())}", styles["BodyText"]),
            Paragraph(f"<b>Uploaded files:</b> {escape(', '.join(data.file_names) or 'None')}", styles["BodyText"]),
            Spacer(1, 6 * mm),
        ]

        summary = [
            ["Selected rows", "Data sources", "Rules", "Discrepancies"],
            [str(data.total_selected_rows), str(len(data.data_sources)), str(len(data.rule_summaries)), str(len(data.discrepancies))],
        ]
        table = Table(summary, colWidths=[55 * mm] * 4)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ECFDF5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#065F46")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        story.extend([table, Spacer(1, 6 * mm), Paragraph("Data sources", styles["Heading2"])])

        source_rows = [["Name", "File", "Sheet", "Header row", "First data row", "Selected rows"]]
        for source in data.data_sources:
            source_rows.append([
                source.name,
                source.file_name or "",
                source.sheet_name,
                str(source.header_row),
                str(source.first_data_row),
                str(len(source.selected_row_numbers)),
            ])
        story.append(Table(source_rows, repeatRows=1, colWidths=[48 * mm, 50 * mm, 40 * mm, 22 * mm, 24 * mm, 24 * mm], style=[
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))

        story.extend([Spacer(1, 6 * mm), Paragraph("Comparison rules", styles["Heading2"])])
        rule_rows = [["Rule", "Type", "Severity", "Discrepancies"]]
        for rule in data.rule_summaries:
            rule_rows.append([rule.rule_name, rule.rule_type.replace("_", " "), rule.severity.title(), str(rule.discrepancy_count)])
        if len(rule_rows) == 1:
            rule_rows.append(["No rules", "-", "-", "0"])
        story.append(Table(rule_rows, repeatRows=1, colWidths=[95 * mm, 55 * mm, 28 * mm, 28 * mm], style=[
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))

        story.extend([Spacer(1, 6 * mm), Paragraph("Fields extracted", styles["Heading2"])])
        field_rows = [["Data source", "Field", "Type", "Column", "Header", "Required"]]
        for source in data.data_sources:
            for field in source.fields:
                field_rows.append([
                    source.name,
                    field.custom_display_name or field.field_name,
                    field.field_type,
                    field.column_letter,
                    field.original_header_label or "",
                    "Yes" if field.required else "No",
                ])
        story.append(Table(field_rows, repeatRows=1, colWidths=[44 * mm, 44 * mm, 22 * mm, 18 * mm, 72 * mm, 16 * mm], style=[
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))

        story.extend([PageBreak(), Paragraph("Detailed discrepancies", styles["Heading1"]), Spacer(1, 4 * mm)])
        detail_rows = [[
            "Rule",
            "Severity",
            "Left location",
            "Right location",
            "Field",
            "Expected",
            "Actual",
            "Suggested correction",
            "Notes",
        ]]
        for item in data.discrepancies:
            left_location = f"{item.left_file_name or '-'} / {item.left_sheet_name or '-'} / row {item.left_row_number or '-'}"
            right_location = f"{item.right_file_name or '-'} / {item.right_sheet_name or '-'} / row {item.right_row_number or '-'}"
            detail_rows.append([
                item.rule_name,
                item.severity.title(),
                left_location,
                right_location,
                item.right_field_name or item.left_field_name or "-",
                item.expected_value or "-",
                item.actual_value or "-",
                item.suggested_correction or "Review item.",
                item.notes or "",
            ])
        if len(detail_rows) == 1:
            detail_rows.append(["No discrepancies", "-", "-", "-", "-", "-", "-", "No correction required.", ""])

        detail = Table([[Paragraph(escape(str(cell)), styles["BodyText"]) for cell in row] for row in detail_rows], repeatRows=1, colWidths=[32 * mm, 16 * mm, 40 * mm, 40 * mm, 24 * mm, 28 * mm, 28 * mm, 44 * mm, 36 * mm])
        detail.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#047857")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(detail)

        def footer(canvas, document):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#64748B"))
            canvas.drawString(10 * mm, 8 * mm, "Generated locally. Original files were not modified.")
            canvas.drawRightString(landscape(A4)[0] - 10 * mm, 8 * mm, f"Page {document.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return destination
