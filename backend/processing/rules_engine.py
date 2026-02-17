"""
Rules Engine for Tax Deduction Analyzer.

This module implements the rules-based classification system that matches
transactions to deduction categories using keyword and merchant patterns.

Validates: Requirements 4.1, 4.3, 10.1, 10.2, 10.3, 10.4
"""

import json
from pathlib import Path
from typing import List, Optional, Tuple
from datetime import datetime

from backend.models.schemas import Rule, NormalisedTransaction, DeductionCategory


class RulesEngine:
    """
    Rules-based classification engine.
    
    Matches transactions to deduction categories using keyword and merchant patterns.
    Supports rule versioning, priority sorting, and confidence scoring.
    """
    
    def __init__(self, rules: List[Rule]):
        """
        Initialize the rules engine with a list of rules.
        
        Args:
            rules: List of Rule objects to use for classification
        """
        self.rules = rules
        # Sort rules by priority (highest first) for consistent evaluation order
        self.rules.sort(key=lambda r: r.priority, reverse=True)
    
    @classmethod
    def load_rules(cls, filepath: str) -> "RulesEngine":
        """
        Load rules from a JSON configuration file.
        
        Args:
            filepath: Path to the rules JSON file
            
        Returns:
            RulesEngine instance with loaded rules
            
        Raises:
            FileNotFoundError: If the rules file doesn't exist
            ValueError: If the rules file is invalid
        """
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Rules file not found: {filepath}")
        
        with open(path, 'r') as f:
            data = json.load(f)
        
        rules = []
        for rule_data in data.get('rules', []):
            # Add created_at timestamp if not present
            if 'created_at' not in rule_data:
                rule_data['created_at'] = datetime.now().isoformat()
            
            rule = Rule(**rule_data)
            rules.append(rule)
        
        return cls(rules)
    
    def match(self, transaction: NormalisedTransaction) -> Optional[Tuple[Rule, float]]:
        """
        Match a transaction against all rules and return the best match.
        
        Implements keyword and merchant matching with priority-based tie-breaking.
        
        Args:
            transaction: The normalised transaction to classify
            
        Returns:
            Tuple of (matched_rule, confidence_score) if a match is found, None otherwise
            
        Validates: Requirements 4.1, 4.3, 10.4
        """
        matches = []
        
        # Normalize transaction text for matching
        description_lower = transaction.description.lower()
        merchant_lower = transaction.merchant.lower()
        
        for rule in self.rules:
            if not rule.enabled:
                continue
            
            # Check keyword matches (case-insensitive substring)
            keyword_matched = False
            for keyword in rule.keywords:
                if keyword.lower() in description_lower or keyword.lower() in merchant_lower:
                    keyword_matched = True
                    break
            
            # Check merchant list matches
            merchant_matched = False
            for merchant in rule.merchants:
                if merchant.lower() == merchant_lower or merchant.lower() in merchant_lower:
                    merchant_matched = True
                    break
            
            # If either keyword or merchant matched, add to matches
            if keyword_matched or merchant_matched:
                matches.append((rule, rule.confidence))
        
        if not matches:
            return None
        
        # Return highest confidence match, with rule priority as tie-breaker
        # Sort by confidence (descending), then by priority (descending)
        best_match = max(matches, key=lambda m: (m[1], m[0].priority))
        return best_match
    
    def get_enabled_rules(self) -> List[Rule]:
        """
        Get all enabled rules.
        
        Returns:
            List of enabled Rule objects
        """
        return [rule for rule in self.rules if rule.enabled]
    
    def get_rules_by_category(self, category: DeductionCategory) -> List[Rule]:
        """
        Get all rules for a specific category.
        
        Args:
            category: The deduction category to filter by
            
        Returns:
            List of Rule objects for the specified category
        """
        return [rule for rule in self.rules if rule.category == category]
