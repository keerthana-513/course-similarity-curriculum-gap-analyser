"""Course management API endpoints."""
import csv
import io
import json
import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
import sqlite3

from app.database import get_db
from app.schemas import CourseCreate, CourseUpdate, CourseResponse

router = APIRouter(prefix="/courses", tags=["Courses"])


def _parse_syllabus_topics(raw: str) -> List[str]:
    """Parse syllabus topics from JSON string or delimiter separated text."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass

    # Split by semicolon, newline, or comma
    delimiters = [";", "\n", ","]
    for delim in delimiters:
        if delim in raw:
            parts = [p.strip() for p in raw.split(delim) if p.strip()]
            if parts:
                return parts

    return [raw.strip()] if raw.strip() else []


def _format_course_row(row: sqlite3.Row) -> dict:
    """Format a database row into a dictionary matching CourseResponse."""
    return {
        "id": row["id"],
        "course_id": row["course_id"],
        "name": row["name"],
        "department": row["department"],
        "semester": row["semester"],
        "description": row["description"],
        "syllabus_topics": _parse_syllabus_topics(row["syllabus_topics"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.get("", response_model=List[CourseResponse])
def list_courses(
    q: Optional[str] = Query(None, description="Search query string"),
    department: Optional[str] = Query(None, description="Filter by department"),
    db: sqlite3.Connection = Depends(get_db),
):
    """Retrieve all courses with optional search and department filtering."""
    query = "SELECT * FROM courses WHERE 1=1"
    params = []

    if q:
        query += (
            " AND (course_id LIKE ? OR name LIKE ? OR description LIKE ? OR syllabus_topics LIKE ?)"
        )
        search_pattern = f"%{q.strip()}%"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern])

    if department:
        query += " AND department = ?"
        params.append(department.strip())

    query += " ORDER BY course_id ASC"
    cursor = db.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    return [_format_course_row(row) for row in rows]


@router.post("", response_model=CourseResponse, status_code=201)
def create_course(course: CourseCreate, db: sqlite3.Connection = Depends(get_db)):
    """Create a new course."""
    cursor = db.cursor()

    # Check if course_id exists
    cursor.execute("SELECT id FROM courses WHERE course_id = ?", (course.course_id,))
    if cursor.fetchone():
        raise HTTPException(
            status_code=400,
            detail=f"Course with ID '{course.course_id}' already exists.",
        )

    # Format syllabus topics to JSON
    if isinstance(course.syllabus_topics, list):
        syllabus_json = json.dumps(course.syllabus_topics)
    else:
        parsed_topics = _parse_syllabus_topics(course.syllabus_topics)
        syllabus_json = json.dumps(parsed_topics)

    now_str = datetime.utcnow().isoformat()
    cursor.execute(
        """
        INSERT INTO courses (course_id, name, department, semester, description, syllabus_topics, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            course.course_id.strip(),
            course.name.strip(),
            course.department.strip(),
            course.semester.strip(),
            course.description.strip(),
            syllabus_json,
            now_str,
            now_str,
        ),
    )
    db.commit()

    cursor.execute("SELECT * FROM courses WHERE course_id = ?", (course.course_id.strip(),))
    row = cursor.fetchone()
    return _format_course_row(row)


@router.get("/sample-csv")
def download_sample_csv():
    """Download a CSV template for importing courses."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "course_id",
        "name",
        "department",
        "semester",
        "description",
        "syllabus_topics",
    ])
    writer.writerow([
        "CS102",
        "Object Oriented Programming",
        "Computer Science",
        "Semester 2",
        "Principles of object-oriented design and programming in Java. Covers inheritance, polymorphism, design patterns, and unit testing.",
        "Classes and Objects; Encapsulation and Inheritance; Polymorphism; Interfaces and Abstract Classes; Exception Handling; Collections Framework; Unit Testing",
    ])
    writer.writerow([
        "DS202",
        "Big Data Systems",
        "Data Science",
        "Semester 4",
        "Architectures and programming paradigms for distributed data processing. Explores Hadoop, Spark, distributed file systems, and real-time streaming.",
        "Distributed Computing Fundamentals; MapReduce Architecture; Apache Spark Core; Spark SQL and DataFrames; Distributed Storage; Stream Processing",
    ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=course_import_template.csv"},
    )


@router.post("/import-csv")
async def import_courses_csv(
    file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)
):
    """Import courses from an uploaded CSV file."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a CSV file.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or malformed.")

    # Normalize header mapping
    field_map = {fn.strip().lower(): fn for fn in reader.fieldnames}
    required_fields = ["course_id", "name", "department", "semester", "description"]
    for req in required_fields:
        if req not in field_map:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required CSV column: '{req}'. Required headers: course_id, name, department, semester, description, syllabus_topics.",
            )

    cursor = db.cursor()
    imported_count = 0
    updated_count = 0
    now_str = datetime.utcnow().isoformat()

    for row in reader:
        c_id = row.get(field_map["course_id"], "").strip()
        name = row.get(field_map["name"], "").strip()
        dept = row.get(field_map["department"], "").strip()
        sem = row.get(field_map["semester"], "").strip()
        desc = row.get(field_map["description"], "").strip()

        if not c_id or not name:
            continue

        raw_topics = row.get(field_map.get("syllabus_topics", ""), "")
        topics = _parse_syllabus_topics(raw_topics)
        topics_json = json.dumps(topics)

        # Check existing
        cursor.execute("SELECT id FROM courses WHERE course_id = ?", (c_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE courses
                SET name = ?, department = ?, semester = ?, description = ?, syllabus_topics = ?, updated_at = ?
                WHERE course_id = ?
                """,
                (name, dept, sem, desc, topics_json, now_str, c_id),
            )
            updated_count += 1
        else:
            cursor.execute(
                """
                INSERT INTO courses (course_id, name, department, semester, description, syllabus_topics, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (c_id, name, dept, sem, desc, topics_json, now_str, now_str),
            )
            imported_count += 1

    db.commit()
    return {
        "status": "success",
        "imported": imported_count,
        "updated": updated_count,
        "total_processed": imported_count + updated_count,
    }


@router.post("/upload")
async def upload_course_document(file: UploadFile = File(...)):
    """Upload syllabus document (PDF or TXT) and extract course content."""
    filename = file.filename.lower()
    content = await file.read()
    extracted_text = ""

    if filename.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            extracted_text = "\n".join([page.extract_text() or "" for page in reader.pages])
        except ImportError:
            try:
                import PyPDF2
                reader = PyPDF2.PdfReader(io.BytesIO(content))
                extracted_text = "\n".join([page.extract_text() or "" for page in reader.pages])
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to extract text from PDF: {str(e)}"
                )
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Could not parse PDF file: {str(e)}"
            )
    elif filename.endswith(".txt"):
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = content.decode("latin-1")
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a .pdf or .txt file.",
        )

    # Heuristic parsing for auto-filling course fields
    inferred_id = ""
    inferred_name = ""
    inferred_department = "Computer Science"
    inferred_semester = "Semester 1"
    inferred_topics = []

    lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]

    # Search for course code e.g. CS101, CSE 201, AI-301
    code_match = re.search(r"\b([A-Z]{2,4}\s*[-]?\s*\d{3})\b", extracted_text)
    if code_match:
        inferred_id = code_match.group(1).replace(" ", "").replace("-", "")

    # Look for title line
    for line in lines[:10]:
        if "course title" in line.lower() or "course name" in line.lower():
            inferred_name = re.sub(r"(?i)course\s+(title|name)\s*[:\-]\s*", "", line).strip()
            break
        elif inferred_id and inferred_id in line and len(line) < 80:
            cleaned = line.replace(inferred_id, "").strip(" :-–")
            if cleaned:
                inferred_name = cleaned
                break

    if not inferred_name and lines:
        inferred_name = lines[0][:80]

    # Search for syllabus/topic bullets
    for line in lines:
        if line.startswith(("-", "*", "•", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.")):
            cleaned_bullet = re.sub(r"^[-*•\d\.]+\s*", "", line).strip()
            if 3 < len(cleaned_bullet) < 100:
                inferred_topics.append(cleaned_bullet)

    return {
        "filename": file.filename,
        "extracted_text_preview": extracted_text[:1000],
        "extracted_topics": inferred_topics[:15],
        "suggested_course": {
            "course_id": inferred_id or "NEW101",
            "name": inferred_name or "New Course",
            "department": inferred_department,
            "semester": inferred_semester,
            "description": extracted_text[:500].strip(),
            "syllabus_topics": inferred_topics[:10],
        },
    }


@router.delete("/sample-data")
def delete_all_sample_data(db: sqlite3.Connection = Depends(get_db)):
    """Delete all course records and clear data."""
    cursor = db.cursor()
    cursor.execute("DELETE FROM courses;")
    cursor.execute("DELETE FROM recommendations;")
    cursor.execute("DELETE FROM analysis_history;")
    db.commit()
    return {"status": "success", "message": "All courses and history data have been removed."}


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Retrieve details for a single course by ID."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM courses WHERE course_id = ?", (course_id.strip(),))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=404, detail=f"Course with ID '{course_id}' was not found."
        )
    return _format_course_row(row)


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: str,
    course_data: CourseUpdate,
    db: sqlite3.Connection = Depends(get_db),
):
    """Update existing course details."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM courses WHERE course_id = ?", (course_id.strip(),))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(
            status_code=404, detail=f"Course with ID '{course_id}' was not found."
        )

    updates = []
    params = []

    if course_data.name is not None:
        updates.append("name = ?")
        params.append(course_data.name.strip())

    if course_data.department is not None:
        updates.append("department = ?")
        params.append(course_data.department.strip())

    if course_data.semester is not None:
        updates.append("semester = ?")
        params.append(course_data.semester.strip())

    if course_data.description is not None:
        updates.append("description = ?")
        params.append(course_data.description.strip())

    if course_data.syllabus_topics is not None:
        if isinstance(course_data.syllabus_topics, list):
            topics_json = json.dumps(course_data.syllabus_topics)
        else:
            parsed = _parse_syllabus_topics(course_data.syllabus_topics)
            topics_json = json.dumps(parsed)
        updates.append("syllabus_topics = ?")
        params.append(topics_json)

    now_str = datetime.utcnow().isoformat()
    updates.append("updated_at = ?")
    params.append(now_str)

    params.append(course_id.strip())
    update_sql = f"UPDATE courses SET {', '.join(updates)} WHERE course_id = ?"
    cursor.execute(update_sql, params)
    db.commit()

    cursor.execute("SELECT * FROM courses WHERE course_id = ?", (course_id.strip(),))
    updated_row = cursor.fetchone()
    return _format_course_row(updated_row)


@router.delete("/{course_id}")
def delete_course(course_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Delete a course by course_id."""
    cursor = db.cursor()
    cursor.execute("SELECT id FROM courses WHERE course_id = ?", (course_id.strip(),))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(
            status_code=404, detail=f"Course with ID '{course_id}' was not found."
        )

    cursor.execute("DELETE FROM courses WHERE course_id = ?", (course_id.strip(),))
    db.commit()
    return {"status": "success", "message": f"Course '{course_id}' was successfully deleted."}
