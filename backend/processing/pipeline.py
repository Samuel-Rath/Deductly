"""
Processing Pipeline for Tax Deduction Analyzer.

This module implements the end-to-end processing pipeline that wires together
all processing components: CSV Parser, Exclusion Engine, Classification Engine,
and Report Generator.

Validates: All backend requirements
"""

from pathlib import Path
from typing import Optional, BinaryIO
from datetime import datetime

from backend.models.schemas import ReportData, ReportSummary
from backend.processing.csv_parser import CSVParser, CSVParseError
from backend.processing.exclusion_engine import ExclusionEngine
from backend.processing.classification_engine import ClassificationEngine
from backend.processing.rules_engine import RulesEngine
from backend.processing.fuzzy_matcher import FuzzyMatcher
from backend.processing.report_generator import ReportGenerator
from backend.processing.audit_trail import AuditTrailBuilder
from backend.storage.storage_service import StorageService
from backend.rag.knowledge_base import ATOKnowledgeBase
from backend.rag.rag_engine import RAGEngine
from backend.rag.llm_classifier import LLMClassifier


class ProcessingPipeline:
    """
    Main processing pipeline that orchestrates all components.
    
    Handles the complete flow from CSV upload to report generation:
    1. Parse and normalise CSV transactions
    2. Apply exclusion rules
    3. Classify deduction candidates
    4. Generate reports (PDF, CSV, JSON)
    5. Record audit trail at each step
    """
    
    def __init__(
        self,
        rules_path: str = "backend/config/rules.json",
        knowledge_path: str = "backend/config/ato_fitness_knowledge.json",
        confidence_threshold: float = 0.60,
        storage_service: Optional[StorageService] = None,
        use_rag: bool = False,
    ):
        """
        Initialize the processing pipeline.

        Args:
            rules_path: Path to rules configuration file
            knowledge_path: Path to ATO fitness knowledge base
            confidence_threshold: Minimum confidence for classification
            storage_service: Optional storage service for persistence
            use_rag: Enable RAG-powered fitness transaction analysis (requires ANTHROPIC_API_KEY)
        """
        self.confidence_threshold = confidence_threshold
        self.storage_service = storage_service

        # Core processing components
        self.csv_parser = CSVParser()
        self.exclusion_engine = ExclusionEngine()

        # Rules engine + fuzzy matcher
        self.rules_engine = RulesEngine.load_rules(rules_path)
        canonical_merchants = set()
        for rule in self.rules_engine.rules:
            canonical_merchants.update(rule.merchants)
        self.fuzzy_matcher = FuzzyMatcher(list(canonical_merchants))

        self.classification_engine = ClassificationEngine(
            rules_engine=self.rules_engine,
            fuzzy_matcher=self.fuzzy_matcher,
            confidence_threshold=confidence_threshold,
        )

        self.report_generator = ReportGenerator(confidence_threshold=confidence_threshold)
        self.audit_builder = AuditTrailBuilder()

        # RAG fitness classifier (optional)
        self.llm_classifier: Optional[LLMClassifier] = None
        if use_rag:
            kb = ATOKnowledgeBase(knowledge_path)
            rag_engine = RAGEngine(knowledge_base=kb)
            if rag_engine.available:
                self.llm_classifier = LLMClassifier(
                    rag_engine=rag_engine,
                    confidence_threshold=0.40,
                    override_threshold=confidence_threshold,
                )
    
    def process(
        self,
        csv_file: Optional[BinaryIO] = None,
        transactions: Optional[list] = None,
        income_year: str = None,
        job_id: Optional[str] = None
    ) -> ReportData:
        """
        Process transactions through the complete pipeline.
        
        This is the main entry point for processing. It:
        1. Parses and normalises transactions (from CSV or accepts pre-parsed)
        2. Records normalisation in audit trail
        3. Applies exclusion rules
        4. Records exclusion checks in audit trail
        5. Classifies deduction candidates
        6. Records classification attempts in audit trail
        7. Aggregates report data with summary statistics
        8. Stores derived fields (if storage service provided)
        
        Args:
            csv_file: Binary file object containing CSV data (optional if transactions provided)
            transactions: Pre-parsed list of NormalisedTransaction objects (optional if csv_file provided)
            income_year: Australian income year (e.g., "2023-2024")
            job_id: Optional job identifier for storage
        
        Returns:
            ReportData with all processed transactions and audit trail
        
        Raises:
            CSVParseError: If CSV parsing fails
            ValueError: If neither csv_file nor transactions provided
            Exception: If processing fails at any step
        """
        try:
            # Step 1: Parse and normalise (from CSV or use provided transactions)
            if transactions is not None:
                # Use pre-parsed transactions (e.g., from PDF parser)
                parsed_transactions = transactions
            elif csv_file is not None:
                # Parse CSV file
                parsed_transactions = self._parse_csv(csv_file)
            else:
                raise ValueError("Either csv_file or transactions must be provided")
            
            # Step 2: Record normalisation in audit trail
            self._record_normalisation(parsed_transactions)
            
            # Step 3: Apply exclusion rules
            candidates, excluded = self._apply_exclusions(parsed_transactions)
            
            # Step 4: Record exclusion checks in audit trail
            self._record_exclusions(parsed_transactions, excluded)

            # Step 5: Classify deduction candidates (rule-based)
            classified = self._classify_candidates(candidates)

            # Step 5b: RAG enhancement for fitness transactions (if enabled)
            if self.llm_classifier:
                classified = self.llm_classifier.enhance(classified)

            # Step 6: Record classification in audit trail
            self._record_classifications(classified)
            
            # Step 7: Record final results for excluded transactions
            self._record_excluded_final_results(excluded)
            
            # Step 8: Aggregate report data
            report_data = self._aggregate_report_data(
                classified=classified,
                excluded=excluded,
                income_year=income_year
            )
            
            # Step 9: Store derived fields if storage service provided
            if self.storage_service and job_id:
                self._store_derived_fields(job_id, classified, excluded)
            
            return report_data
        
        except CSVParseError:
            # Re-raise CSV parsing errors as-is
            raise
        
        except Exception as e:
            # Wrap other errors with context
            raise Exception(f"Pipeline processing failed: {str(e)}") from e
    
    def _parse_csv(self, csv_file: BinaryIO):
        """
        Parse CSV file and normalise transactions.
        
        Args:
            csv_file: Binary file object containing CSV data
        
        Returns:
            List of normalised transactions
        """
        return self.csv_parser.parse_and_normalise(csv_file)
    
    def _record_normalisation(self, transactions):
        """
        Record normalisation step in audit trail for all transactions.
        
        Args:
            transactions: List of normalised transactions
        """
        for txn in transactions:
            self.audit_builder.record_normalisation(
                transaction=txn,
                original_description=txn.description,
                extracted_merchant=txn.merchant,
                detected_payment_rail=txn.payment_rail,
                recurring_detected=txn.recurring_flag
            )
    
    def _apply_exclusions(self, transactions):
        """
        Apply exclusion rules to filter non-deductible transactions.
        
        Args:
            transactions: List of normalised transactions
        
        Returns:
            Tuple of (candidates, excluded_transactions)
        """
        return self.exclusion_engine.filter(transactions)
    
    def _record_exclusions(self, transactions, excluded):
        """
        Record exclusion checks in audit trail.
        
        Args:
            transactions: All normalised transactions
            excluded: List of excluded transactions
        """
        # Create lookup for excluded transactions
        excluded_ids = {ex.transaction.transaction_id for ex in excluded}
        
        for txn in transactions:
            if txn.transaction_id in excluded_ids:
                # Find the excluded transaction
                ex_txn = next(
                    ex for ex in excluded 
                    if ex.transaction.transaction_id == txn.transaction_id
                )
                
                self.audit_builder.record_exclusion_check(
                    transaction_id=txn.transaction_id,
                    check_name="exclusion_filter",
                    pattern=ex_txn.reason.value,
                    matched=True,
                    reason=ex_txn.reason
                )
            else:
                # Transaction passed all exclusion checks
                self.audit_builder.record_exclusion_check(
                    transaction_id=txn.transaction_id,
                    check_name="exclusion_filter",
                    pattern="all_checks",
                    matched=False
                )
    
    def _classify_candidates(self, candidates):
        """
        Classify deduction candidates.
        
        Args:
            candidates: List of transactions that passed exclusion
        
        Returns:
            List of classified transactions
        """
        return self.classification_engine.classify(candidates)
    
    def _record_classifications(self, classified):
        """
        Record classification attempts and final results in audit trail.
        
        Args:
            classified: List of classified transactions
        """
        for cls_txn in classified:
            # Record classification attempt if there was a matched rule
            if cls_txn.matched_rule_id:
                self.audit_builder.record_classification_attempt(
                    transaction_id=cls_txn.transaction.transaction_id,
                    rule_id=cls_txn.matched_rule_id,
                    rule_version=cls_txn.matched_rule_version or "1.0",
                    category=cls_txn.category.value if cls_txn.category else "unclassified",
                    confidence=cls_txn.confidence,
                    matched=True,
                    match_reason=cls_txn.reason
                )
            
            # Record final result
            self.audit_builder.record_final_result(
                transaction_id=cls_txn.transaction.transaction_id,
                category=cls_txn.category.value if cls_txn.category else None,
                confidence=cls_txn.confidence,
                matched_rule_id=cls_txn.matched_rule_id,
                matched_rule_version=cls_txn.matched_rule_version,
                reason=cls_txn.reason,
                evidence_checklist=[e.value for e in cls_txn.evidence_checklist],
                flags=cls_txn.flags,
                excluded=False
            )
    
    def _record_excluded_final_results(self, excluded):
        """
        Record final results for excluded transactions in audit trail.
        
        Args:
            excluded: List of excluded transactions
        """
        for ex_txn in excluded:
            self.audit_builder.record_final_result(
                transaction_id=ex_txn.transaction.transaction_id,
                category=None,
                confidence=0.0,
                matched_rule_id=None,
                matched_rule_version=None,
                reason="excluded",
                evidence_checklist=[],
                flags=[],
                excluded=True,
                exclusion_reason=ex_txn.reason.value,
                exclusion_explanation=ex_txn.explanation
            )
    
    def _aggregate_report_data(self, classified, excluded, income_year):
        """
        Aggregate all data into a structured report.
        
        Args:
            classified: List of classified transactions
            excluded: List of excluded transactions
            income_year: Income year string
        
        Returns:
            ReportData object
        """
        # Build audit trail
        audit_trail = self.audit_builder.build()
        
        # Use report generator to aggregate data
        report_data = self.report_generator.aggregate_report_data(
            candidates=classified,
            excluded=excluded,
            audit_trail=audit_trail,
            income_year=income_year
        )
        
        return report_data
    
    def _store_derived_fields(self, job_id, classified, excluded):
        """
        Store derived fields if storage service is available.
        
        Args:
            job_id: Job identifier
            classified: List of classified transactions
            excluded: List of excluded transactions
        """
        if not self.storage_service.ephemeral_mode:
            self.storage_service.save_classified_transactions(job_id, classified)
            self.storage_service.save_excluded_transactions(job_id, excluded)
    
    def generate_reports(
        self,
        report_data: ReportData,
        output_dir: Path,
        generate_pdf: bool = True,
        generate_csv: bool = True,
        generate_json: bool = True
    ) -> dict:
        """
        Generate report files in specified formats.
        
        Args:
            report_data: Complete report data
            output_dir: Directory where reports should be written
            generate_pdf: Whether to generate PDF report
            generate_csv: Whether to generate CSV export
            generate_json: Whether to generate JSON audit trail
        
        Returns:
            Dictionary with paths to generated files
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        generated_files = {}
        
        # Generate PDF
        if generate_pdf:
            try:
                pdf_path = output_dir / "deduction_report.pdf"
                self.report_generator.generate_pdf(report_data, str(pdf_path))
                generated_files["pdf"] = str(pdf_path)
            except (ImportError, OSError) as e:
                # WeasyPrint not available or system dependencies missing
                print(f"Warning: PDF generation skipped: {str(e)}")
                generated_files["pdf"] = None
        
        # Generate CSV
        if generate_csv:
            csv_path = output_dir / "deductions.csv"
            self.report_generator.generate_csv(report_data, str(csv_path))
            generated_files["csv"] = str(csv_path)
        
        # Generate JSON audit trail
        if generate_json:
            json_path = output_dir / "audit_trail.json"
            self.report_generator.generate_audit_trail(report_data, str(json_path))
            generated_files["json"] = str(json_path)
        
        return generated_files
    
    def process_and_generate_reports(
        self,
        csv_file: Optional[BinaryIO] = None,
        transactions: Optional[list] = None,
        income_year: str = None,
        output_dir: Path = None,
        job_id: Optional[str] = None,
        generate_pdf: bool = True,
        generate_csv: bool = True,
        generate_json: bool = True
    ) -> tuple:
        """
        Complete end-to-end processing: parse transactions and generate all reports.
        
        This is a convenience method that combines process() and generate_reports().
        
        Args:
            csv_file: Binary file object containing CSV data (optional if transactions provided)
            transactions: Pre-parsed list of NormalisedTransaction objects (optional if csv_file provided)
            income_year: Australian income year
            output_dir: Directory where reports should be written
            job_id: Optional job identifier for storage
            generate_pdf: Whether to generate PDF report
            generate_csv: Whether to generate CSV export
            generate_json: Whether to generate JSON audit trail
        
        Returns:
            Tuple of (report_data, generated_files)
        """
        # Process through pipeline
        report_data = self.process(
            csv_file=csv_file,
            transactions=transactions,
            income_year=income_year,
            job_id=job_id
        )
        
        # Generate reports
        generated_files = self.generate_reports(
            report_data=report_data,
            output_dir=output_dir,
            generate_pdf=generate_pdf,
            generate_csv=generate_csv,
            generate_json=generate_json
        )
        
        return report_data, generated_files
