from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.validation_models import RuleDiscrepancy, ValidationResult
from app.reports.base_report_generator import BaseReportGenerator

_TEXT_REPLACEMENTS = str.maketrans({
    "\u00a0": " ",
    "\u20b1": "PHP ",
    "\u2013": "-",
    "\u2014": "-",
    "\u2212": "-",
    "\u00d7": "x",
    "\u2022": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u00b0": " deg",
    "\u2264": "<=",
    "\u2265": ">=",
    "\u2248": "~",
})

PAGE_WIDTH, _ = landscape(A4)
CONTENT_WIDTH = PAGE_WIDTH - (20 * mm)


def pdf_text(value: object) -> str:
    """Return text that ReportLab's built-in PDF fonts can safely draw."""
    text = "" if value is None else str(value)
    text = text.translate(_TEXT_REPLACEMENTS)
    return text.encode("latin-1", "replace").decode("latin-1")


def pdf_markup(value: object) -> str:
    return escape(pdf_text(value)).replace("\n", "<br/>")


def pdf_paragraph(value: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(pdf_markup(value), style)


def paragraph_row(values: list[object], style: ParagraphStyle) -> list[Paragraph]:
    return [pdf_paragraph(value, style) for value in values]


def build_table(
    rows: list[list[object]],
    col_widths: list[float],
    header_style: ParagraphStyle,
    body_style: ParagraphStyle,
    header_fill: str = "#F8FAFC",
    header_text: str = "#0F172A",
) -> Table:
    paragraph_rows = []
    for index, row in enumerate(rows):
        paragraph_rows.append(paragraph_row(row, header_style if index == 0 else body_style))

    table = Table(paragraph_rows, repeatRows=1, colWidths=col_widths, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_fill)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(header_text)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def location_text(file_name: str | None, sheet_name: str | None, row_number: int | None) -> str:
    return f"{file_name or '-'}\n{sheet_name or '-'}\nRow {row_number or '-'}"


def discrepancy_field(item: RuleDiscrepancy) -> str:
    return item.right_field_name or item.left_field_name or "-"


class PdfReportGenerator(BaseReportGenerator[ValidationResult]):
    def generate(self, data: ValidationResult, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        styles = getSampleStyleSheet()
        title = ParagraphStyle(
            "ReportTitle",
            parent=styles["Title"],
            textColor=colors.HexColor("#047857"),
            alignment=TA_CENTER,
            fontSize=16,
            leading=20,
        )
        section_title = ParagraphStyle("SectionTitle", parent=styles["Heading2"], fontSize=12, leading=15, spaceBefore=4, spaceAfter=6)
        body = ParagraphStyle("ReportBody", parent=styles["BodyText"], fontSize=7.5, leading=9.5, splitLongWords=1, wordWrap="CJK")
        small = ParagraphStyle("ReportSmall", parent=body, fontSize=7, leading=8.5)
        header = ParagraphStyle("ReportHeader", parent=small, fontName="Helvetica-Bold", textColor=colors.HexColor("#0F172A"))
        green_header = ParagraphStyle("ReportGreenHeader", parent=header, textColor=colors.HexColor("#065F46"), alignment=TA_CENTER)
        centered_body = ParagraphStyle("ReportCenteredBody", parent=body, alignment=TA_CENTER)
        detail_title = ParagraphStyle("DetailTitle", parent=styles["Heading3"], fontSize=9.5, leading=12, textColor=colors.HexColor("#0F172A"), spaceBefore=5, spaceAfter=3)
        label = ParagraphStyle("DetailLabel", parent=small, fontName="Helvetica-Bold", textColor=colors.HexColor("#475569"))

        doc = SimpleDocTemplate(
            str(destination),
            pagesize=landscape(A4),
            rightMargin=10 * mm,
            leftMargin=10 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
        )

        story = [
            Paragraph("Comparison Builder Validation Report", title),
            Spacer(1, 6 * mm),
            Paragraph(f"<b>Project:</b> {pdf_markup(data.project_name)}", body),
            Paragraph(f"<b>Generated:</b> {pdf_markup(data.created_at)}", body),
            Paragraph(f"<b>Preset:</b> {pdf_markup(data.preset.replace('_', ' ').title())}", body),
            Paragraph(f"<b>Uploaded files:</b> {pdf_markup(', '.join(data.file_names) or 'None')}", body),
            Spacer(1, 5 * mm),
        ]

        summary = [
            ["Selected rows", "Data sources", "Rules", "Discrepancies"],
            [data.total_selected_rows, len(data.data_sources), len(data.rule_summaries), len(data.discrepancies)],
        ]
        summary_table = Table(
            [paragraph_row(summary[0], green_header), paragraph_row(summary[1], centered_body)],
            colWidths=[CONTENT_WIDTH / 4] * 4,
            hAlign="LEFT",
        )
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ECFDF5")),
            ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([summary_table, Spacer(1, 5 * mm), Paragraph("Data sources", section_title)])

        source_rows = [["Name", "File", "Sheet", "Header row", "First data row", "Selected rows"]]
        for source in data.data_sources:
            source_rows.append([
                source.name,
                source.file_name or "",
                source.sheet_name,
                source.header_row,
                source.first_data_row,
                len(source.selected_row_numbers),
            ])
        if len(source_rows) == 1:
            source_rows.append(["No data sources", "-", "-", "-", "-", "-"])
        story.append(build_table(source_rows, [48 * mm, 54 * mm, 34 * mm, 21 * mm, 25 * mm, 24 * mm], header, small))

        story.extend([Spacer(1, 5 * mm), Paragraph("Comparison rules", section_title)])
        rule_rows = [["Rule", "Type", "Severity", "Discrepancies"]]
        for rule in data.rule_summaries:
            rule_rows.append([rule.rule_name, rule.rule_type.replace("_", " "), rule.severity.title(), rule.discrepancy_count])
        if len(rule_rows) == 1:
            rule_rows.append(["No rules", "-", "-", "0"])
        story.append(build_table(rule_rows, [105 * mm, 55 * mm, 28 * mm, 28 * mm], header, small))

        story.extend([Spacer(1, 5 * mm), Paragraph("Fields extracted", section_title)])
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
        if len(field_rows) == 1:
            field_rows.append(["No mapped fields", "-", "-", "-", "-", "-"])
        story.append(build_table(field_rows, [52 * mm, 42 * mm, 20 * mm, 18 * mm, 70 * mm, 16 * mm], header, small))

        story.extend([PageBreak(), Paragraph("Detailed discrepancies", section_title)])
        if not data.discrepancies:
            story.append(Paragraph("No discrepancies were found for the enabled rules.", body))
        for index, item in enumerate(data.discrepancies, start=1):
            story.append(Paragraph(f"Issue {index}: {pdf_markup(item.rule_name)}", detail_title))
            detail_rows = [
                ["Severity", item.severity.title(), "Field", discrepancy_field(item)],
                ["Expected location", location_text(item.left_file_name, item.left_sheet_name, item.left_row_number), "Actual location", location_text(item.right_file_name, item.right_sheet_name, item.right_row_number)],
                ["Expected value", item.expected_value or "-", "Actual value", item.actual_value or "-"],
                ["Suggested correction", item.suggested_correction or "Review item.", "Notes", item.notes or "-"],
            ]
            detail_table = Table(
                [[pdf_paragraph(row[0], label), pdf_paragraph(row[1], small), pdf_paragraph(row[2], label), pdf_paragraph(row[3], small)] for row in detail_rows],
                colWidths=[31 * mm, 100 * mm, 31 * mm, 100 * mm],
                hAlign="LEFT",
            )
            detail_table.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8FAFC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(detail_table)
            story.append(Spacer(1, 2.5 * mm))

        def footer(canvas, document):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#64748B"))
            canvas.drawString(10 * mm, 8 * mm, "Generated locally. Original files were not modified.")
            canvas.drawRightString(landscape(A4)[0] - 10 * mm, 8 * mm, f"Page {document.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        return destination
