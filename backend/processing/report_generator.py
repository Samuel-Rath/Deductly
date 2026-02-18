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

from models.schemas import (
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    ReportSummary,
    AuditEntry,
    DeductionCategory,
)


class ReportGenerator:
    """
    Generates comprehensive deduction reports in multiple formats.
    
    Validates: Requirements 8.1-8.8, 9.1-9.3
    """
    
    def __init__(self, confidence_threshold: float = 0.60):
        """
        Initialize report generator.
        
        Args:
            confidence_threshold: Threshold for flagging items as needs_review
        """
        self.confidence_threshold = confidence_threshold
    
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
        
        Validates: Requirements 9.1
        
        Args:
            report_data: Complete report data
            output_path: Path where CSV file should be written
        """
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Combine candidates and needs_review for CSV export
        all_candidates = report_data.candidates + report_data.needs_review
        
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
        
        Validates: Requirements 9.2, 9.3
        
        Args:
            report_data: Complete report data
            output_path: Path where JSON file should be written
        """
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Build audit trail structure
        audit_data = {
            "income_year": report_data.income_year,
            "generated_at": report_data.generated_at.isoformat(),
            "transactions": []
        }
        
        # Sort audit entries by transaction_id for deterministic output
        sorted_entries = sorted(report_data.audit_trail, key=lambda e: e.transaction_id)
        
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
    
    def generate_pdf(self, report_data: ReportData, output_path: str) -> None:
        """
        Generate PDF report with comprehensive deduction analysis.
        
        Creates a formatted PDF with header, summary section, line item tables,
        needs review section, excluded items, and footer with guidance.
        Uses "likely deductible" language throughout.
        
        Validates: Requirements 8.1-8.8
        
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
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Generate HTML content
        html_content = self._generate_html_report(report_data)
        
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
        """
        Get CSS styles for PDF report using design system.
        
        Returns:
            CSS string
        """
        return """
        @page {
            size: A4;
            margin: 2cm;
        }
        
        body {
            font-family: 'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #0A0A0A;
        }
        
        h1 {
            font-size: 24pt;
            font-weight: 600;
            margin-bottom: 0.5em;
            color: #0A0A0A;
        }
        
        h2 {
            font-size: 16pt;
            font-weight: 600;
            margin-top: 1.5em;
            margin-bottom: 0.75em;
            color: #0A0A0A;
            border-bottom: 1px solid #2A2A2A;
            padding-bottom: 0.25em;
        }
        
        h3 {
            font-size: 12pt;
            font-weight: 600;
            margin-top: 1em;
            margin-bottom: 0.5em;
            color: #0A0A0A;
        }
        
        .header {
            margin-bottom: 2em;
        }
        
        .disclaimer {
            background-color: #F5F5F5;
            padding: 1em;
            border-left: 3px solid #8A8A8A;
            margin-bottom: 1.5em;
            font-size: 9pt;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1em;
            margin-bottom: 2em;
        }
        
        .summary-card {
            background-color: #F9F9F9;
            padding: 1em;
            border: 1px solid #CFCFCF;
            border-radius: 8px;
        }
        
        .summary-card .label {
            font-size: 9pt;
            color: #8A8A8A;
            margin-bottom: 0.25em;
        }
        
        .summary-card .value {
            font-size: 18pt;
            font-weight: 600;
            color: #0A0A0A;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2em;
            font-size: 9pt;
        }
        
        th {
            background-color: #F5F5F5;
            padding: 0.75em 0.5em;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #2A2A2A;
        }
        
        td {
            padding: 0.75em 0.5em;
            border-bottom: 1px solid #CFCFCF;
            vertical-align: top;
        }
        
        tr:hover {
            background-color: #FAFAFA;
        }
        
        .amount {
            text-align: right;
            font-weight: 500;
        }
        
        .confidence {
            font-weight: 500;
        }
        
        .confidence-high {
            color: #0A0A0A;
        }
        
        .confidence-medium {
            color: #5A5A5A;
        }
        
        .confidence-low {
            color: #8A8A8A;
        }
        
        .category-chip {
            display: inline-block;
            padding: 0.25em 0.5em;
            background-color: #F0F0F0;
            border: 1px solid #CFCFCF;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 500;
        }
        
        .flag {
            display: inline-block;
            padding: 0.25em 0.5em;
            background-color: #FFF9E6;
            border: 1px solid #FFE066;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 500;
            margin-right: 0.25em;
        }
        
        .footer {
            margin-top: 3em;
            padding-top: 1.5em;
            border-top: 1px solid #2A2A2A;
            font-size: 8pt;
            color: #5A5A5A;
        }
        
        .footer h3 {
            font-size: 10pt;
            margin-top: 1em;
        }
        
        .footer p {
            margin-bottom: 0.75em;
        }
        
        .page-break {
            page-break-after: always;
        }
        """
    
    def _generate_header(self, report_data: ReportData) -> str:
        """Generate PDF header section."""
        return f"""
    <div class="header">
        <h1>Tax Deduction Report</h1>
        <p><strong>Income Year:</strong> {report_data.income_year} (1 July to 30 June)</p>
        <p><strong>Generated:</strong> {report_data.generated_at.strftime('%d/%m/%Y at %H:%M')}</p>
        
        <div class="disclaimer">
            <strong>Important:</strong> This report identifies likely deductible transactions based on 
            automated analysis. All items require your confirmation and appropriate substantiation. 
            This is not tax advice. Consult a registered tax agent or the ATO for guidance specific 
            to your circumstances.
        </div>
    </div>
"""
    
    def _generate_summary_section(self, report_data: ReportData) -> str:
        """Generate summary section with totals and distribution."""
        summary = report_data.summary
        
        # Format category totals
        category_rows = ""
        for category, amount in sorted(summary.category_totals.items()):
            category_display = category.replace('_', ' ').title()
            category_rows += f"""
            <tr>
                <td>{category_display}</td>
                <td class="amount">AUD ${amount:,.2f}</td>
            </tr>
"""
        
        return f"""
    <h2>Summary</h2>
    
    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">Likely Deductible Total</div>
            <div class="value">AUD ${summary.total_deductible:,.2f}</div>
        </div>
        <div class="summary-card">
            <div class="label">Needs Review Total</div>
            <div class="value">AUD ${summary.total_needs_review:,.2f}</div>
        </div>
        <div class="summary-card">
            <div class="label">Excluded Total</div>
            <div class="value">AUD ${summary.total_excluded:,.2f}</div>
        </div>
        <div class="summary-card">
            <div class="label">Confidence Distribution</div>
            <div class="value">
                High: {summary.confidence_distribution.get('high', 0)} | 
                Medium: {summary.confidence_distribution.get('medium', 0)} | 
                Low: {summary.confidence_distribution.get('low', 0)}
            </div>
        </div>
    </div>
    
    <h3>Category Totals</h3>
    <table>
        <thead>
            <tr>
                <th>Category</th>
                <th class="amount">Total Amount</th>
            </tr>
        </thead>
        <tbody>
{category_rows}
        </tbody>
    </table>
"""
    
    def _generate_candidates_section(self, report_data: ReportData) -> str:
        """Generate deduction candidates section."""
        if not report_data.candidates:
            return """
    <h2>Likely Deductible Candidates</h2>
    <p>No high-confidence deduction candidates found.</p>
"""
        
        rows = ""
        for transaction in report_data.candidates:
            rows += self._generate_transaction_row(transaction)
        
        return f"""
    <h2>Likely Deductible Candidates</h2>
    <p>These transactions have been classified with high confidence as likely deductible. 
    Review each item and ensure you have the required evidence.</p>
    
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th class="amount">Amount</th>
                <th>Category</th>
                <th>Confidence</th>
                <th>Evidence Needed</th>
            </tr>
        </thead>
        <tbody>
{rows}
        </tbody>
    </table>
"""
    
    def _generate_needs_review_section(self, report_data: ReportData) -> str:
        """Generate needs review section."""
        if not report_data.needs_review:
            return ""
        
        rows = ""
        for transaction in report_data.needs_review:
            rows += self._generate_transaction_row(transaction)
        
        return f"""
    <div class="page-break"></div>
    <h2>Needs Review</h2>
    <p>These transactions have lower confidence scores or require additional context. 
    Review carefully and determine if they are deductible in your circumstances.</p>
    
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th class="amount">Amount</th>
                <th>Category</th>
                <th>Confidence</th>
                <th>Evidence Needed</th>
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
            rows += f"""
            <tr>
                <td>{excluded.transaction.date.strftime('%d/%m/%Y')}</td>
                <td>{self._escape_html(excluded.transaction.merchant)}</td>
                <td>{self._escape_html(excluded.transaction.description)}</td>
                <td class="amount">AUD ${excluded.transaction.absolute_amount:,.2f}</td>
                <td>{reason_display}</td>
                <td>{self._escape_html(excluded.explanation)}</td>
            </tr>
"""
        
        return f"""
    <div class="page-break"></div>
    <h2>Excluded Items</h2>
    <p>These transactions were excluded from deduction candidates for the following reasons:</p>
    
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th class="amount">Amount</th>
                <th>Reason</th>
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
        # Format confidence
        confidence_pct = transaction.confidence * 100
        if transaction.confidence >= 0.80:
            confidence_class = "confidence-high"
        elif transaction.confidence >= 0.60:
            confidence_class = "confidence-medium"
        else:
            confidence_class = "confidence-low"
        
        # Format category
        category_display = ""
        if transaction.category:
            category_name = transaction.category.value.replace('_', ' ').title()
            category_display = f'<span class="category-chip">{category_name}</span>'
        
        # Format evidence
        evidence_list = [e.value.replace('_', ' ').title() for e in transaction.evidence_checklist]
        evidence_display = '<br>'.join(evidence_list)
        
        # Format flags
        flags_display = ""
        if transaction.flags:
            for flag in transaction.flags:
                flag_text = flag.replace('_', ' ').title()
                flags_display += f'<span class="flag">{flag_text}</span>'
        
        return f"""
            <tr>
                <td>{transaction.transaction.date.strftime('%d/%m/%Y')}</td>
                <td>{self._escape_html(transaction.transaction.merchant)}</td>
                <td>{self._escape_html(transaction.transaction.description)}</td>
                <td class="amount">AUD ${transaction.transaction.absolute_amount:,.2f}</td>
                <td>{category_display}</td>
                <td class="confidence {confidence_class}">{confidence_pct:.0f}%</td>
                <td>{evidence_display}{flags_display}</td>
            </tr>
"""
    
    def _generate_footer(self) -> str:
        """Generate footer with guidance and substantiation notes."""
        return """
    <div class="footer">
        <h3>Record Retention Guidance</h3>
        <p>
            Generally, you must keep records for five years from the date you lodge your tax return. 
            However, some records may need to be kept longer depending on your circumstances. 
            Refer to the Australian Taxation Office guidance for specific requirements.
        </p>
        
        <h3>Substantiation Requirements</h3>
        <p>
            For most work-related expenses, you need written evidence (such as receipts or invoices) 
            if the total claim amount is more than $300. However, there are exceptions and specific 
            rules for different types of expenses. The $300 threshold does not apply to claims for 
            car, meal allowance, award transport payments allowance, or travel allowance expenses.
        </p>
        <p>
            For car expenses, you must choose a calculation method (logbook or cents per kilometre) 
            and keep appropriate records. For working from home expenses, record-keeping requirements 
            depend on the method you use. For donations, ensure the organisation has deductible gift 
            recipient (DGR) status.
        </p>
        
        <h3>Important Notes</h3>
        <p>
            This report is generated by automated analysis and is intended to assist with record-keeping. 
            It does not constitute tax advice. You are responsible for confirming the deductibility of 
            each item and maintaining appropriate substantiation. Consult a registered tax agent or the 
            Australian Taxation Office for guidance specific to your circumstances.
        </p>
        
        <p style="margin-top: 2em; text-align: center; color: #8A8A8A;">
            Generated by Tax Deduction Analyzer | Australian Taxation Office guidance references current as of generation date
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
