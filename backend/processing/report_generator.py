"""
Report Generator for Tax Deduction Analyzer.

This module generates PDF, CSV, and JSON reports from classified transactions.
Implements report data aggregation, formatting, and export functionality.

Validates: Requirements 8.1-8.8, 9.1-9.3
"""

from decimal import Decimal
from datetime import datetime
from typing import List, Dict, Tuple
from pathlib import Path
import csv
import json

from backend.models.schemas import (
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    ReportSummary,
    AuditEntry,
    DeductionCategory,
)
from backend.processing.redaction_service import RedactionService, RedactionConfig


class ReportGenerator:
    """
    Generates comprehensive deduction reports in multiple formats.
    
    Validates: Requirements 8.1-8.8, 9.1-9.3
    """
    
    def __init__(self, confidence_threshold: float = 0.60, redaction_config: RedactionConfig = None):
        """
        Initialize report generator.
        
        Args:
            confidence_threshold: Threshold for flagging items as needs_review
            redaction_config: Configuration for sensitive data redaction
        """
        self.confidence_threshold = confidence_threshold
        self.redaction_service = RedactionService(redaction_config)
    
    def aggregate_report_data(
        self,
        candidates: List[ClassifiedTransaction],
        excluded: List[ExcludedTransaction],
        audit_trail: List[AuditEntry],
        income_year: str
    ) -> ReportData:
        """
        Aggregate all transaction data into a structured report.
        
        Separates transactions into candidates, needs_review, and excluded lists.
        Calculates summary statistics including category totals and confidence distribution.
        
        Validates: Requirements 8.2, 8.3
        
        Args:
            candidates: List of classified transactions
            excluded: List of excluded transactions
            audit_trail: Complete audit trail for all transactions
            income_year: Income year string (e.g., "2023-2024")
        
        Returns:
            ReportData object with all aggregated information
        """
        # Separate candidates into high-confidence and needs_review
        high_confidence = []
        needs_review = []
        
        for transaction in candidates:
            if transaction.confidence < self.confidence_threshold or "needs_review" in transaction.flags:
                needs_review.append(transaction)
            else:
                high_confidence.append(transaction)
        
        # Calculate summary statistics
        summary = self._calculate_summary(high_confidence, needs_review, excluded)
        
        # Create report data
        report_data = ReportData.model_construct(
            income_year=income_year,
            generated_at=datetime.now(),
            summary=summary,
            candidates=high_confidence,
            needs_review=needs_review,
            excluded=excluded,
            audit_trail=audit_trail
        )
        
        return report_data
    
    def _calculate_summary(
        self,
        candidates: List[ClassifiedTransaction],
        needs_review: List[ClassifiedTransaction],
        excluded: List[ExcludedTransaction]
    ) -> ReportSummary:
        """
        Calculate summary statistics for the report.
        
        Validates: Requirements 8.2, 8.3
        
        Args:
            candidates: High-confidence deduction candidates
            needs_review: Low-confidence items requiring review
            excluded: Excluded transactions
        
        Returns:
            ReportSummary with totals and distributions
        """
        # Calculate totals
        total_deductible = sum(
            t.transaction.absolute_amount for t in candidates
        )
        total_needs_review = sum(
            t.transaction.absolute_amount for t in needs_review
        )
        total_excluded = sum(
            t.transaction.absolute_amount for t in excluded
        )
        
        # Calculate category totals
        category_totals: Dict[str, Decimal] = {}
        for transaction in candidates + needs_review:
            if transaction.category:
                category_name = transaction.category.value
                if category_name not in category_totals:
                    category_totals[category_name] = Decimal(0)
                category_totals[category_name] += transaction.transaction.absolute_amount
        
        # Calculate confidence distribution
        confidence_distribution = self._calculate_confidence_distribution(
            candidates + needs_review
        )
        
        return ReportSummary(
            total_deductible=total_deductible,
            total_needs_review=total_needs_review,
            total_excluded=total_excluded,
            category_totals=category_totals,
            confidence_distribution=confidence_distribution
        )
    
    def _calculate_confidence_distribution(
        self,
        transactions: List[ClassifiedTransaction]
    ) -> Dict[str, int]:
        """
        Calculate confidence distribution (high/medium/low counts).
        
        Args:
            transactions: List of classified transactions
        
        Returns:
            Dictionary with counts for each confidence level
        """
        distribution = {"high": 0, "medium": 0, "low": 0}
        
        for transaction in transactions:
            if transaction.confidence >= 0.80:
                distribution["high"] += 1
            elif transaction.confidence >= 0.60:
                distribution["medium"] += 1
            else:
                distribution["low"] += 1
        
        return distribution
    
    def generate_csv(self, report_data: ReportData, output_path: str) -> None:
        """
        Generate CSV export with all deduction candidates.
        
        Creates a CSV file with all required columns including date, merchant,
        description, amount, category, confidence, reason, evidence, and flags.
        Applies redaction to sensitive data before export.
        
        Validates: Requirements 9.1, 12.3
        
        Args:
            report_data: Complete report data
            output_path: Path where CSV file should be written
        """
        # Apply redaction to report data
        redacted_data = self.redaction_service.redact_report_data(report_data)
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Combine candidates and needs_review for CSV export
        all_candidates = redacted_data.candidates + redacted_data.needs_review
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'date',
                'merchant',
                'description',
                'amount',
                'category',
                'confidence',
                'reason',
                'evidence_needed',
                'flags'
            ]
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for transaction in all_candidates:
                # Format evidence checklist
                evidence_list = [e.value for e in transaction.evidence_checklist]
                evidence_str = ', '.join(evidence_list)
                
                # Format flags
                flags_str = ', '.join(transaction.flags) if transaction.flags else ''
                
                # Format category
                category_str = transaction.category.value if transaction.category else ''
                
                # Write row
                writer.writerow({
                    'date': transaction.transaction.date.strftime('%d/%m/%Y'),
                    'merchant': transaction.transaction.merchant,
                    'description': transaction.transaction.description,
                    'amount': f"{transaction.transaction.absolute_amount:.2f}",
                    'category': category_str,
                    'confidence': f"{transaction.confidence:.2f}",
                    'reason': transaction.reason,
                    'evidence_needed': evidence_str,
                    'flags': flags_str
                })
    
    def generate_audit_trail(self, report_data: ReportData, output_path: str) -> None:
        """
        Generate JSON audit trail export.
        
        Serializes the complete audit trail to JSON format with all processing
        steps for each transaction. Output is deterministic (same input = same output).
        Applies redaction to sensitive data before export.
        
        Validates: Requirements 9.2, 9.3, 12.3
        
        Args:
            report_data: Complete report data
            output_path: Path where JSON file should be written
        """
        # Apply redaction to report data
        redacted_data = self.redaction_service.redact_report_data(report_data)
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Build audit trail structure
        audit_data = {
            "income_year": redacted_data.income_year,
            "generated_at": redacted_data.generated_at.isoformat(),
            "transactions": []
        }
        
        # Sort audit entries by transaction_id for deterministic output
        sorted_entries = sorted(redacted_data.audit_trail, key=lambda e: e.transaction_id)
        
        for entry in sorted_entries:
            transaction_audit = {
                "transaction_id": entry.transaction_id,
                "normalisation": entry.normalisation,
                "exclusion_checks": entry.exclusion_checks,
                "classification_attempts": entry.classification_attempts,
                "final_result": entry.final_result
            }
            audit_data["transactions"].append(transaction_audit)
        
        # Write JSON with sorted keys for deterministic output
        with open(output_file, 'w', encoding='utf-8') as jsonfile:
            json.dump(audit_data, jsonfile, indent=2, sort_keys=True, default=str)
    
    # -----------------------------------------------------------------------
    # Description helpers
    # -----------------------------------------------------------------------

    _GENERIC_DESCRIPTIONS = frozenset({
        "transaction", "transfer", "transfer in", "transfer out",
        "eftpos", "eftpos debit", "eftpos purchase", "eftpos credit",
        "visa", "visa purchase", "visa debit", "visa credit",
        "mastercard", "mastercard purchase",
        "payment", "direct debit", "direct credit",
        "debit", "credit", "pos", "tap and go", "contactless",
        "internet banking", "internet transfer", "online transfer",
        "purchase", "withdrawal", "deposit",
    })

    def _keywords_from_reason(self, reason: str) -> str:
        """Extract human-readable matched terms from a reason string."""
        import re
        m = re.search(r'keyword_match:\s*([^;|]+)', reason)
        if m:
            return m.group(1).strip().title()
        m = re.search(r'merchant_match:\s*([^(;|]+)', reason)
        if m:
            return m.group(1).strip().title()
        return ""

    def _format_description(self, txn: "ClassifiedTransaction") -> tuple:
        """Return (primary, detail) description strings for PDF display.

        When the raw bank description is a generic placeholder such as
        "Transaction" or "EFTPOS Purchase", this synthesises a more useful
        label from the matched merchant name and classification keywords so
        the tax accountant can tell at a glance what the charge was for.
        """
        raw = txn.transaction.description.strip()
        merchant = txn.transaction.merchant.strip()
        is_generic = (
            raw.lower() in self._GENERIC_DESCRIPTIONS
            or len(raw) <= 3
            or raw.lower() == merchant.lower()
        )

        keywords = self._keywords_from_reason(txn.reason)

        if not is_generic:
            # The raw description is meaningful — use it as-is
            detail = f"Matched on: {keywords}" if keywords else ""
            return raw, detail

        # Generic — synthesise something useful
        if merchant and merchant.lower() not in self._GENERIC_DESCRIPTIONS:
            primary = merchant.title()
        elif txn.category:
            primary = txn.category.value.replace('_', ' ').title()
        else:
            primary = "Bank Transaction"

        detail = f"Matched on: {keywords}" if keywords else ""
        return primary, detail

    def generate_pdf(self, report_data: ReportData, output_path: str) -> None:
        """
        Generate PDF report with comprehensive deduction analysis.
        
        Creates a formatted PDF with header, summary section, line item tables,
        needs review section, excluded items, and footer with guidance.
        Uses "likely deductible" language throughout.
        Applies redaction to sensitive data before export.
        
        Validates: Requirements 8.1-8.8, 12.3
        
        Args:
            report_data: Complete report data
            output_path: Path where PDF file should be written
        """
        try:
            from weasyprint import HTML, CSS
        except ImportError:
            raise ImportError(
                "WeasyPrint is required for PDF generation. "
                "Install it with: pip install weasyprint"
            )
        
        # Apply redaction to report data
        redacted_data = self.redaction_service.redact_report_data(report_data)
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Generate HTML content
        html_content = self._generate_html_report(redacted_data)
        
        # Generate PDF from HTML
        HTML(string=html_content).write_pdf(output_file)
    
    def _generate_html_report(self, report_data: ReportData) -> str:
        """
        Generate HTML content for PDF report.
        
        Args:
            report_data: Complete report data
        
        Returns:
            HTML string with embedded CSS
        """
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        {self._get_pdf_styles()}
    </style>
</head>
<body>
    {self._generate_header(report_data)}
    {self._generate_summary_section(report_data)}
    {self._generate_candidates_section(report_data)}
    {self._generate_needs_review_section(report_data)}
    {self._generate_excluded_section(report_data)}
    {self._generate_footer()}
</body>
</html>
"""
        return html
    
    def _get_pdf_styles(self) -> str:
        """Get CSS styles for PDF report."""
        return """
        @page {
            size: A4;
            margin: 2cm 2cm 2.5cm 2cm;
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-family: Arial, sans-serif;
                font-size: 8pt;
                color: #888888;
            }
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5pt;
            line-height: 1.5;
            color: #1A1A1A;
        }

        /* ── Headings ───────────────────────────────────────────── */
        h1 {
            font-size: 22pt;
            font-weight: 700;
            color: #1A1A1A;
            margin: 0 0 0.15em 0;
        }
        h2 {
            font-size: 13pt;
            font-weight: 700;
            color: #7A5C00;
            margin: 1.6em 0 0.5em 0;
            padding: 0.35em 0.6em;
            background-color: #FDF6E3;
            border-left: 4px solid #B8860B;
        }
        h3 {
            font-size: 10.5pt;
            font-weight: 700;
            color: #1A1A1A;
            margin: 1em 0 0.4em 0;
        }

        /* ── Header block ───────────────────────────────────────── */
        .report-header {
            border-bottom: 3px solid #B8860B;
            padding-bottom: 0.75em;
            margin-bottom: 1.2em;
        }
        .report-meta {
            font-size: 9pt;
            color: #555555;
            margin-top: 0.25em;
        }

        /* ── Disclaimer ─────────────────────────────────────────── */
        .disclaimer {
            background-color: #FFF8E1;
            border: 1px solid #F0C04A;
            border-left: 4px solid #B8860B;
            padding: 0.7em 0.9em;
            margin: 1em 0 1.5em 0;
            font-size: 8.5pt;
            color: #444444;
        }

        /* ── Summary cards (table-based for WeasyPrint) ─────────── */
        .summary-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 8pt 0;
            margin-bottom: 1.5em;
        }
        .summary-table td {
            width: 33%;
            background-color: #F9F5EC;
            border: 1px solid #DDD0A8;
            padding: 0.8em 1em;
            vertical-align: top;
        }
        .summary-label {
            font-size: 8pt;
            color: #7A5C00;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .summary-value {
            font-size: 16pt;
            font-weight: 700;
            color: #1A1A1A;
            margin-top: 0.1em;
        }
        .summary-value-small {
            font-size: 12pt;
            font-weight: 700;
            color: #1A1A1A;
            margin-top: 0.1em;
        }

        /* ── Category section headings ──────────────────────────── */
        .category-heading {
            background-color: #F0E8D0;
            border-bottom: 1px solid #C8A84B;
            padding: 0.4em 0.6em;
            font-size: 10pt;
            font-weight: 700;
            color: #5C4000;
            margin-bottom: 0;
        }
        .category-total {
            float: right;
            font-weight: 700;
            color: #333333;
        }

        /* ── Transaction tables ─────────────────────────────────── */
        table.txn-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5em;
            font-size: 8.5pt;
        }
        table.txn-table th {
            background-color: #F2EBD9;
            padding: 0.55em 0.5em;
            text-align: left;
            font-weight: 700;
            font-size: 8pt;
            color: #5C4000;
            border-bottom: 2px solid #C8A84B;
            white-space: nowrap;
        }
        table.txn-table th.right {
            text-align: right;
        }
        table.txn-table td {
            padding: 0.55em 0.5em;
            border-bottom: 1px solid #E8E0CC;
            vertical-align: top;
        }
        table.txn-table tr:nth-child(even) td {
            background-color: #FDFAF3;
        }

        /* ── Simple 2-col tables (category totals, etc.) ────────── */
        table.simple-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5em;
            font-size: 9pt;
        }
        table.simple-table th {
            background-color: #F5F5F5;
            padding: 0.5em 0.6em;
            text-align: left;
            font-weight: 700;
            border-bottom: 2px solid #CCCCCC;
        }
        table.simple-table td {
            padding: 0.5em 0.6em;
            border-bottom: 1px solid #EEEEEE;
        }

        /* ── Cell types ─────────────────────────────────────────── */
        .amount {
            text-align: right;
            font-weight: 600;
            white-space: nowrap;
        }
        .date-col {
            white-space: nowrap;
            color: #555555;
        }
        .merchant-col {
            font-weight: 600;
            color: #1A1A1A;
        }
        .desc-main {
            color: #1A1A1A;
        }
        .desc-detail {
            font-size: 7.5pt;
            color: #777777;
            margin-top: 1px;
        }
        .reason-col {
            font-size: 8pt;
            color: #444444;
            font-style: italic;
        }

        /* ── Confidence badges ──────────────────────────────────── */
        .badge {
            display: inline-block;
            padding: 0.15em 0.45em;
            border-radius: 3px;
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.03em;
        }
        .badge-high   { background-color: #E6F4EA; color: #1E6B34; border: 1px solid #A8D5B5; }
        .badge-medium { background-color: #FFF3CD; color: #7A5C00; border: 1px solid #F0C04A; }
        .badge-low    { background-color: #FDE8E8; color: #8B2020; border: 1px solid #F4AAAA; }

        /* ── Flags ──────────────────────────────────────────────── */
        .flag {
            display: inline-block;
            padding: 0.1em 0.4em;
            background-color: #FFF3CD;
            border: 1px solid #F0C04A;
            border-radius: 3px;
            font-size: 7.5pt;
            font-weight: 600;
            margin: 1px 1px 0 0;
            color: #7A5C00;
        }

        /* ── Evidence list ──────────────────────────────────────── */
        .evidence-item {
            font-size: 7.5pt;
            color: #333333;
            margin-bottom: 1px;
        }
        .evidence-item::before {
            content: "\\2713  ";
            color: #B8860B;
            font-weight: 700;
        }

        /* ── Footer ─────────────────────────────────────────────── */
        .footer {
            margin-top: 3em;
            padding-top: 1em;
            border-top: 2px solid #B8860B;
            font-size: 8pt;
            color: #555555;
        }
        .footer h3 {
            font-size: 9.5pt;
            color: #7A5C00;
            margin: 0.8em 0 0.3em 0;
        }
        .footer p { margin: 0 0 0.5em 0; }

        /* ── Page breaks ────────────────────────────────────────── */
        .page-break { page-break-after: always; }
        .avoid-break { page-break-inside: avoid; }
        """
    
    def _generate_header(self, report_data: ReportData) -> str:
        """Generate PDF header section."""
        total_items = len(report_data.candidates) + len(report_data.needs_review)
        return f"""
    <div class="report-header">
        <h1>Tax Deduction Report</h1>
        <div class="report-meta">
            Income Year: <strong>{report_data.income_year}</strong> (1 July &ndash; 30 June)
            &nbsp;&nbsp;|&nbsp;&nbsp;
            Generated: <strong>{report_data.generated_at.strftime('%d %B %Y at %H:%M')}</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            {total_items} transactions analysed
        </div>
    </div>

    <div class="disclaimer">
        <strong>Important notice:</strong> This report identifies <em>likely</em> deductible
        transactions based on automated keyword and pattern analysis. Every item must be
        individually confirmed by you or your tax agent before lodgement. This is not tax
        advice. Consult a registered tax agent or the ATO for guidance specific to your
        circumstances. All amounts are in AUD.
    </div>
"""
    
    def _generate_summary_section(self, report_data: ReportData) -> str:
        """Generate summary section with totals and distribution."""
        summary = report_data.summary

        hi  = summary.confidence_distribution.get('high', 0)
        med = summary.confidence_distribution.get('medium', 0)
        low = summary.confidence_distribution.get('low', 0)

        # Category breakdown rows
        category_rows = ""
        for category, amount in sorted(summary.category_totals.items()):
            cat_display = category.replace('_', ' ').title()
            category_rows += f"""
            <tr>
                <td>{cat_display}</td>
                <td class="amount">${amount:,.2f}</td>
            </tr>"""

        return f"""
    <h2>Summary</h2>

    <table class="summary-table">
        <tr>
            <td>
                <div class="summary-label">Likely Deductible</div>
                <div class="summary-value">${summary.total_deductible:,.2f}</div>
            </td>
            <td>
                <div class="summary-label">Needs Review</div>
                <div class="summary-value">${summary.total_needs_review:,.2f}</div>
            </td>
            <td>
                <div class="summary-label">Excluded / Not Deductible</div>
                <div class="summary-value">${summary.total_excluded:,.2f}</div>
            </td>
        </tr>
    </table>

    <table class="simple-table" style="width:60%;">
        <thead>
            <tr>
                <th>ATO Deduction Category</th>
                <th style="text-align:right;">Total (AUD)</th>
            </tr>
        </thead>
        <tbody>
{category_rows}
        </tbody>
    </table>

    <p style="font-size:8.5pt; color:#555555; margin-bottom:1.5em;">
        Confidence breakdown across all analysed items &mdash;
        <strong>{hi}</strong> high &nbsp;/&nbsp;
        <strong>{med}</strong> medium &nbsp;/&nbsp;
        <strong>{low}</strong> low.
        Items marked <em>Needs Review</em> appear in a separate section below.
    </p>
"""
    
    def _generate_candidates_section(self, report_data: ReportData) -> str:
        """Generate deduction candidates section, grouped by ATO category."""
        if not report_data.candidates:
            return """
    <h2>Likely Deductible Items</h2>
    <p>No high-confidence deduction candidates found.</p>
"""
        # Group by category
        from collections import defaultdict
        groups: dict = defaultdict(list)
        for txn in report_data.candidates:
            key = txn.category.value if txn.category else "uncategorised"
            groups[key].append(txn)

        sections = ""
        for cat_key in sorted(groups.keys()):
            txns = groups[cat_key]
            cat_label = cat_key.replace('_', ' ').title()
            cat_total = sum(t.transaction.absolute_amount for t in txns)
            rows = "".join(self._generate_transaction_row(t) for t in txns)
            sections += f"""
    <div class="avoid-break">
    <div class="category-heading">
        {self._escape_html(cat_label)}
        <span class="category-total">{len(txns)} item{'s' if len(txns) != 1 else ''} &nbsp;&mdash;&nbsp; AUD ${cat_total:,.2f}</span>
    </div>
    <table class="txn-table">
        <thead>
            <tr>
                <th style="width:9%;">Date</th>
                <th style="width:18%;">Merchant</th>
                <th>Description / Classification Basis</th>
                <th class="right" style="width:11%;">Amount</th>
                <th style="width:8%;">Confidence</th>
                <th style="width:20%;">Evidence Needed</th>
            </tr>
        </thead>
        <tbody>
{rows}
        </tbody>
    </table>
    </div>
"""

        return f"""
    <h2>Likely Deductible Items</h2>
    <p style="font-size:8.5pt; color:#555555; margin-bottom:1em;">
        High-confidence items grouped by ATO deduction category.
        Confirm each item and gather the listed evidence before lodgement.
    </p>
{sections}
"""
    
    def _generate_needs_review_section(self, report_data: ReportData) -> str:
        """Generate needs review section."""
        if not report_data.needs_review:
            return ""

        rows = "".join(self._generate_transaction_row(t) for t in report_data.needs_review)
        review_total = sum(t.transaction.absolute_amount for t in report_data.needs_review)

        return f"""
    <div class="page-break"></div>
    <h2>Needs Review &mdash; AUD ${review_total:,.2f}</h2>
    <p style="font-size:8.5pt; color:#555555; margin-bottom:1em;">
        These items had a lower confidence score or triggered a flag requiring
        professional judgement (e.g. mixed-use assets, method selection, or an
        ambiguous transaction description). Discuss each item with your tax agent.
    </p>

    <table class="txn-table">
        <thead>
            <tr>
                <th style="width:9%;">Date</th>
                <th style="width:18%;">Merchant</th>
                <th>Description / Classification Basis</th>
                <th class="right" style="width:11%;">Amount</th>
                <th style="width:8%;">Confidence</th>
                <th style="width:20%;">Evidence / Action Needed</th>
            </tr>
        </thead>
        <tbody>
{rows}
        </tbody>
    </table>
"""
    
    def _generate_excluded_section(self, report_data: ReportData) -> str:
        """Generate excluded items section."""
        if not report_data.excluded:
            return ""

        rows = ""
        for excluded in report_data.excluded:
            reason_display = excluded.reason.value.replace('_', ' ').title()
            desc = excluded.transaction.description.strip()
            merchant = excluded.transaction.merchant.strip()
            is_generic = desc.lower() in self._GENERIC_DESCRIPTIONS or desc.lower() == merchant.lower()
            display_desc = merchant.title() if is_generic and merchant else desc
            rows += f"""
            <tr>
                <td class="date-col">{excluded.transaction.date.strftime('%d/%m/%Y')}</td>
                <td class="merchant-col">{self._escape_html(merchant)}</td>
                <td>{self._escape_html(display_desc)}</td>
                <td class="amount">${excluded.transaction.absolute_amount:,.2f}</td>
                <td><span class="badge badge-low">{self._escape_html(reason_display)}</span></td>
                <td style="font-size:8pt; color:#555555;">{self._escape_html(excluded.explanation)}</td>
            </tr>
"""

        return f"""
    <div class="page-break"></div>
    <h2>Excluded Items</h2>
    <p style="font-size:8.5pt; color:#555555; margin-bottom:1em;">
        These transactions were automatically excluded. No action required, but
        review the explanation column if any item looks incorrect.
    </p>

    <table class="txn-table">
        <thead>
            <tr>
                <th style="width:9%;">Date</th>
                <th style="width:18%;">Merchant</th>
                <th>Description</th>
                <th class="right" style="width:11%;">Amount</th>
                <th style="width:16%;">Reason</th>
                <th>Explanation</th>
            </tr>
        </thead>
        <tbody>
{rows}
        </tbody>
    </table>
"""
    
    def _generate_transaction_row(self, transaction: ClassifiedTransaction) -> str:
        """Generate a table row for a classified transaction."""
        # Confidence badge
        if transaction.confidence >= 0.80:
            badge_class, badge_text = "badge-high", "HIGH"
        elif transaction.confidence >= 0.60:
            badge_class, badge_text = "badge-medium", "MEDIUM"
        else:
            badge_class, badge_text = "badge-low", "LOW"
        confidence_display = (
            f'<span class="badge {badge_class}">{badge_text}</span>'
            f'<br><span style="font-size:7pt;color:#888;">'
            f'{transaction.confidence * 100:.0f}%</span>'
        )

        # Smart description
        primary_desc, detail_note = self._format_description(transaction)
        desc_html = f'<div class="desc-main">{self._escape_html(primary_desc)}</div>'
        if detail_note:
            desc_html += f'<div class="desc-detail">{self._escape_html(detail_note)}</div>'

        # Flags (excluding needs_review — that's shown by section placement)
        display_flags = [f for f in transaction.flags if f != "needs_review"]
        flags_html = ""
        if display_flags:
            for flag in display_flags:
                flag_text = flag.replace('_', ' ').title()
                flags_html += f'<span class="flag">{self._escape_html(flag_text)}</span>'

        # Evidence checklist
        evidence_items = ""
        for ev in transaction.evidence_checklist:
            ev_label = ev.value.replace('_', ' ').title()
            evidence_items += f'<div class="evidence-item">{self._escape_html(ev_label)}</div>'
        evidence_cell = evidence_items + (f'<div style="margin-top:2px;">{flags_html}</div>' if flags_html else "")

        return f"""
            <tr>
                <td class="date-col">{transaction.transaction.date.strftime('%d/%m/%Y')}</td>
                <td class="merchant-col">{self._escape_html(transaction.transaction.merchant.title())}</td>
                <td>{desc_html}</td>
                <td class="amount">${transaction.transaction.absolute_amount:,.2f}</td>
                <td style="text-align:center;">{confidence_display}</td>
                <td>{evidence_cell}</td>
            </tr>
"""
    
    def _generate_footer(self) -> str:
        """Generate footer with per-category ATO substantiation notes."""
        return """
    <div class="page-break"></div>
    <div class="footer">
        <h3>Accountant Reference &mdash; ATO Substantiation Requirements by Category</h3>

        <table class="simple-table" style="font-size:8pt;">
            <thead>
                <tr>
                    <th style="width:22%;">Category</th>
                    <th>What to Substantiate</th>
                    <th style="width:30%;">Key Rules</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Work Software</strong></td>
                    <td>Tax invoice or receipt showing subscription/licence name and period.</td>
                    <td>Fully deductible if used solely for work. Apportion if personal use occurs.</td>
                </tr>
                <tr>
                    <td><strong>Phone &amp; Internet</strong></td>
                    <td>Usage diary (4-week representative period) or itemised bill. Record work-use %.</td>
                    <td>Only the work-use portion is deductible. Percentage claim must be reasonable.</td>
                </tr>
                <tr>
                    <td><strong>Working From Home</strong></td>
                    <td>Time records (hours worked from home) and evidence of running expenses.</td>
                    <td>Use ATO Fixed Rate (67&cent;/hr) or Actual Cost method. Keep diary for 4 weeks.</td>
                </tr>
                <tr>
                    <td><strong>Work Equipment</strong></td>
                    <td>Receipt or invoice. For items &gt;$300, depreciation schedule required.</td>
                    <td>Items &le;$300 can be claimed in full immediately. Items &gt;$300 depreciated.</td>
                </tr>
                <tr>
                    <td><strong>Training &amp; Education</strong></td>
                    <td>Enrolment confirmation, receipt, and evidence course relates to current role.</td>
                    <td>Must directly relate to current employment. Cannot claim for new career.</td>
                </tr>
                <tr>
                    <td><strong>Professional Memberships</strong></td>
                    <td>Membership invoice or renewal receipt.</td>
                    <td>Must be relevant to current employment. Union fees are fully deductible.</td>
                </tr>
                <tr>
                    <td><strong>Travel</strong></td>
                    <td>Logbook (if car), travel diary (&gt;5 nights away), receipts for all expenses.</td>
                    <td>Home-to-work commute is <em>not</em> deductible. Use logbook or c/km method for car.</td>
                </tr>
                <tr>
                    <td><strong>Donations</strong></td>
                    <td>Receipt showing amount, date, and DGR status of the organisation.</td>
                    <td>Organisation must be a Deductible Gift Recipient (DGR). Check ABN Lookup.</td>
                </tr>
                <tr>
                    <td><strong>Bank Fees</strong></td>
                    <td>Bank statement or fee notice showing the charge relates to income-producing account.</td>
                    <td>Fees on personal accounts are generally not deductible.</td>
                </tr>
            </tbody>
        </table>

        <h3>Record Retention</h3>
        <p>
            Keep all records for <strong>five years</strong> from the date you lodge your return
            (or five years from the date you incur the expense, whichever is later). Digital copies
            of receipts are acceptable provided they are clear and legible.
        </p>

        <h3>General Notes</h3>
        <p>
            Written evidence (receipt or invoice) is required for any individual expense &gt;$300
            and whenever the total work-related claim exceeds $300. The $300 written-evidence
            threshold does not apply to car, travel allowance, or meal allowance expenses.
        </p>
        <p>
            This report was produced by automated analysis and does not constitute tax advice.
            Confirm all items with a registered tax agent before lodgement.
        </p>

        <p style="margin-top:1.5em; text-align:center; color:#AAAAAA; font-size:7.5pt;">
            Generated by Deductly &nbsp;|&nbsp; ATO guidance current as at date of generation
        </p>
    </div>
"""
    
    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters."""
        return (text
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&#39;'))
