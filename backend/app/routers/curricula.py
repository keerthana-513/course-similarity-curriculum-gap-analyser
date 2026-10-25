"""Reference curricula management API endpoints."""
import json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
import sqlite3

from app.database import get_db
from app.schemas import (
    ReferenceCurriculumCreate,
    ReferenceCurriculumUpdate,
    ReferenceCurriculumResponse,
)

router = APIRouter(prefix="/curricula", tags=["Reference Curricula"])


def _format_curriculum_row(row: sqlite3.Row) -> dict:
    """Format reference curriculum row for API response."""
    topics = []
    if row["topics"]:
        try:
            parsed = json.loads(row["topics"])
            if isinstance(parsed, list):
                topics = [str(t).strip() for t in parsed if str(t).strip()]
            else:
                topics = [str(parsed)]
        except Exception:
            topics = [t.strip() for t in row["topics"].split(",") if t.strip()]

    return {
        "id": row["id"],
        "name": row["name"],
        "department": row["department"],
        "topics": topics,
        "created_at": row["created_at"],
    }


@router.get("", response_model=List[ReferenceCurriculumResponse])
def list_curricula(db: sqlite3.Connection = Depends(get_db)):
    """List all benchmark reference curricula."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reference_curricula ORDER BY id ASC")
    rows = cursor.fetchall()
    return [_format_curriculum_row(row) for row in rows]


@router.post("", response_model=ReferenceCurriculumResponse, status_code=201)
def create_curriculum(
    curriculum: ReferenceCurriculumCreate, db: sqlite3.Connection = Depends(get_db)
):
    """Create a new reference curriculum benchmark."""
    cursor = db.cursor()
    now_str = datetime.utcnow().isoformat()
    topics_json = json.dumps(curriculum.topics)

    cursor.execute(
        """
        INSERT INTO reference_curricula (name, department, topics, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (curriculum.name.strip(), curriculum.department.strip(), topics_json, now_str),
    )
    db.commit()

    new_id = cursor.lastrowid
    cursor.execute("SELECT * FROM reference_curricula WHERE id = ?", (new_id,))
    row = cursor.fetchone()
    return _format_curriculum_row(row)


@router.get("/{curriculum_id}", response_model=ReferenceCurriculumResponse)
def get_curriculum(curriculum_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get a specific reference curriculum by ID."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reference_curricula WHERE id = ?", (curriculum_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=404, detail=f"Reference curriculum with ID {curriculum_id} not found."
        )
    return _format_curriculum_row(row)


@router.put("/{curriculum_id}", response_model=ReferenceCurriculumResponse)
def update_curriculum(
    curriculum_id: int,
    curriculum_data: ReferenceCurriculumUpdate,
    db: sqlite3.Connection = Depends(get_db),
):
    """Update a reference curriculum benchmark."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reference_curricula WHERE id = ?", (curriculum_id,))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(
            status_code=404, detail=f"Reference curriculum with ID {curriculum_id} not found."
        )

    updates = []
    params = []

    if curriculum_data.name is not None:
        updates.append("name = ?")
        params.append(curriculum_data.name.strip())

    if curriculum_data.department is not None:
        updates.append("department = ?")
        params.append(curriculum_data.department.strip())

    if curriculum_data.topics is not None:
        updates.append("topics = ?")
        params.append(json.dumps(curriculum_data.topics))

    if updates:
        params.append(curriculum_id)
        sql = f"UPDATE reference_curricula SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(sql, params)
        db.commit()

    cursor.execute("SELECT * FROM reference_curricula WHERE id = ?", (curriculum_id,))
    row = cursor.fetchone()
    return _format_curriculum_row(row)


@router.delete("/{curriculum_id}")
def delete_curriculum(curriculum_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Delete a reference curriculum benchmark."""
    cursor = db.cursor()
    cursor.execute("SELECT id FROM reference_curricula WHERE id = ?", (curriculum_id,))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(
            status_code=404, detail=f"Reference curriculum with ID {curriculum_id} not found."
        )

    cursor.execute("DELETE FROM reference_curricula WHERE id = ?", (curriculum_id,))
    db.commit()
    return {
        "status": "success",
        "message": f"Reference curriculum {curriculum_id} deleted successfully.",
    }
