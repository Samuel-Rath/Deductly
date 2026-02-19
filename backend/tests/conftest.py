"""
Pytest configuration for backend tests
"""
import os
import pytest

# Set testing environment variable before any imports
os.environ["TESTING"] = "true"
