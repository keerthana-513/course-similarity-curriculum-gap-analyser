"""SQLite database configuration and helper functions for Course Gap Analyzer."""
import os
import sqlite3
from pathlib import Path
from typing import Generator

# Define base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "courses.db"


def ensure_data_directory() -> None:
    """Ensure that the data directory exists."""
    os.makedirs(DATA_DIR, exist_ok=True)


def get_db_connection() -> sqlite3.Connection:
    """Create and return a SQLite database connection with row factory enabled."""
    ensure_data_directory()
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Initialize database tables if they do not exist."""
    ensure_data_directory()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Courses table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                semester TEXT NOT NULL,
                description TEXT NOT NULL,
                syllabus_topics TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

        # Reference Curricula table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS reference_curricula (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                topics TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

        # Analysis History table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_type TEXT NOT NULL,
                parameters TEXT NOT NULL,
                results_summary TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

        # Recommendations table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER,
                type TEXT NOT NULL,
                related_courses TEXT NOT NULL,
                evidence TEXT NOT NULL,
                reason TEXT NOT NULL,
                suggested_action TEXT NOT NULL,
                priority TEXT DEFAULT 'medium',
                created_at TEXT NOT NULL,
                FOREIGN KEY (analysis_id) REFERENCES analysis_history (id) ON DELETE CASCADE
            );
            """
        )

        conn.commit()
    finally:
        conn.close()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency for obtaining a database connection."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
