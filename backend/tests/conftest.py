"""
Pytest configuration for backend tests
"""
import os
import pytest

# Set testing environment variable before any imports
os.environ["TESTING"] = "true"


@pytest.fixture(autouse=True, scope="session")
def init_test_database():
    """
    Initialise the SQLite schema once per test session, then tear it down.

    Tests that use ephemeral_mode=False will write to the jobs table.
    Without this fixture the table doesn't exist and those tests fail with
    sqlite3.OperationalError: no such table: jobs.

    Uses the same default path that Database() uses so no patching is needed.
    """
    from backend.storage.database import init_database, drop_database

    # Use the same default path that Database() defaults to
    db_path = "tax_deduction_analyzer.db"
    init_database(db_path)
    yield
    # Best-effort cleanup — on Windows the SQLite file may still be held open
    # by connections created during the test session, so we ignore lock errors.
    try:
        drop_database(db_path)
    except PermissionError:
        pass
