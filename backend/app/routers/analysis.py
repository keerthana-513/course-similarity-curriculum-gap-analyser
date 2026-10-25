"""Curriculum similarity, gap analysis, and advisory recommendation endpoints."""
import csv
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
import sqlite3

from app.database import get_db
from app.nlp_engine import SimilarityEngine
from app.gap_analyzer import GapAnalyzer
from app.recommendation_engine import RecommendationEngine, DISCLAIMER_TEXT
from app.schemas import (
    SimilarityAnalysisRequest,
    SimilarityAnalysisResponse,
    GapAnalysisRequest,
    GapAnalysisResponse,
    RecommendationItem,
    AnalysisHistoryResponse,
    EngineStatusResponse,
)

router = APIRouter(prefix="/analysis", tags=["Analysis & Recommendations"])

# Global analysis engines
similarity_engine = SimilarityEngine(load_model_on_init=True)
gap_analyzer = GapAnalyzer(similarity_engine=similarity_engine)
recommendation_engine = RecommendationEngine()


def _fetch_all_courses(db: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Retrieve all courses from the database and format syllabus topics."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM courses ORDER BY course_id ASC")
    rows = cursor.fetchall()

    courses = []
    for r in rows:
        topics = []
        raw = r["syllabus_topics"]
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    topics = parsed
                else:
                    topics = [str(parsed)]
            except Exception:
                topics = [t.strip() for t in raw.split(",") if t.strip()]

        courses.append({
            "id": r["id"],
            "course_id": r["course_id"],
            "name": r["name"],
            "department": r["department"],
            "semester": r["semester"],
            "description": r["description"],
            "syllabus_topics": topics,
        })
    return courses


def _parse_related_courses(raw: str) -> List[str]:
    """Parse related courses string from DB into a string list."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except Exception:
        pass
    return [c.strip() for c in raw.split(",") if c.strip()]


@router.get("/status", response_model=EngineStatusResponse)
def get_engine_status():
    """Get the current operational status of the NLP similarity engines."""
    is_semantic = similarity_engine.semantic_available
    return {
        "semantic_available": is_semantic,
        "default_method": "semantic" if is_semantic else "tfidf",
        "models_loaded": (
            ["all-MiniLM-L6-v2 (SentenceTransformers)", "TF-IDF (Scikit-Learn)"]
            if is_semantic
            else ["TF-IDF (Scikit-Learn)"]
        ),
    }


@router.post("/similarity", response_model=SimilarityAnalysisResponse)
def run_similarity_analysis(
    request: SimilarityAnalysisRequest, db: sqlite3.Connection = Depends(get_db)
):
    """Run course pairwise similarity analysis and generate actionable recommendations."""
    courses = _fetch_all_courses(db)
    if not courses:
        return {
            "analysis_id": None,
            "method": request.method,
            "threshold": request.threshold,
            "similarity_matrix": [],
            "course_labels": [],
            "course_ids": [],
            "ranked_pairs": [],
            "high_overlap_pairs": [],
            "recommendations": [],
        }

    # Run NLP Analysis
    sim_results = similarity_engine.analyze_courses(
        courses=courses, method=request.method, threshold=request.threshold
    )

    # Generate Recommendations
    recommendations_data = recommendation_engine.generate_recommendations(
        similarity_results=sim_results, threshold=request.threshold
    )

    # Store analysis record in database
    cursor = db.cursor()
    now_str = datetime.utcnow().isoformat()
    params_json = json.dumps({
        "method": request.method,
        "threshold": request.threshold,
        "course_count": len(courses),
    })

    # Prepare summary data for persistence
    summary_data = {
        "method": sim_results["method"],
        "threshold": sim_results["threshold"],
        "course_labels": sim_results["course_labels"],
        "course_ids": sim_results["course_ids"],
        "similarity_matrix": sim_results["similarity_matrix"],
        "ranked_pairs": sim_results["ranked_pairs"],
        "high_overlap_pairs": sim_results["high_overlap_pairs"],
    }
    summary_json = json.dumps(summary_data)

    cursor.execute(
        """
        INSERT INTO analysis_history (analysis_type, parameters, results_summary, created_at)
        VALUES (?, ?, ?, ?)
        """,
        ("similarity", params_json, summary_json, now_str),
    )
    analysis_id = cursor.lastrowid

    # Store generated recommendations
    saved_recommendations: List[dict] = []
    for rec in recommendations_data:
        related_courses_json = json.dumps(rec.get("related_courses", []))
        cursor.execute(
            """
            INSERT INTO recommendations (analysis_id, type, related_courses, evidence, reason, suggested_action, priority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                rec["type"],
                related_courses_json,
                rec["evidence"],
                rec["reason"],
                rec["suggested_action"],
                rec.get("priority", "medium"),
                now_str,
            ),
        )
        rec_id = cursor.lastrowid
        saved_recommendations.append({
            "id": rec_id,
            "analysis_id": analysis_id,
            "type": rec["type"],
            "related_courses": rec.get("related_courses", []),
            "evidence": rec["evidence"],
            "reason": rec["reason"],
            "suggested_action": rec["suggested_action"],
            "priority": rec.get("priority", "medium"),
            "disclaimer": DISCLAIMER_TEXT,
            "created_at": now_str,
        })

    db.commit()

    return {
        "analysis_id": analysis_id,
        "method": sim_results["method"],
        "threshold": sim_results["threshold"],
        "similarity_matrix": sim_results["similarity_matrix"],
        "course_labels": sim_results["course_labels"],
        "course_ids": sim_results["course_ids"],
        "ranked_pairs": sim_results["ranked_pairs"],
        "high_overlap_pairs": sim_results["high_overlap_pairs"],
        "recommendations": saved_recommendations,
    }


@router.post("/gap", response_model=GapAnalysisResponse)
def run_gap_analysis(
    request: GapAnalysisRequest, db: sqlite3.Connection = Depends(get_db)
):
    """Run curriculum gap analysis against a selected reference benchmark."""
    cursor = db.cursor()
    cursor.execute(
        "SELECT * FROM reference_curricula WHERE id = ?", (request.curriculum_id,)
    )
    curriculum = cursor.fetchone()
    if not curriculum:
        raise HTTPException(
            status_code=404,
            detail=f"Reference curriculum with ID {request.curriculum_id} not found.",
        )

    # Parse reference topics
    reference_topics = []
    if curriculum["topics"]:
        try:
            parsed = json.loads(curriculum["topics"])
            if isinstance(parsed, list):
                reference_topics = [str(t).strip() for t in parsed if str(t).strip()]
        except Exception:
            reference_topics = [
                t.strip() for t in curriculum["topics"].split(",") if t.strip()
            ]

    courses = _fetch_all_courses(db)

    # Perform Gap Analysis
    gap_results = gap_analyzer.analyze_coverage(
        courses=courses, reference_topics=reference_topics, method=request.method
    )

    # Generate Recommendations for Gaps
    recommendations_data = recommendation_engine.generate_recommendations(
        gap_results=gap_results
    )

    # Persist in Database
    now_str = datetime.utcnow().isoformat()
    params_json = json.dumps({
        "curriculum_id": request.curriculum_id,
        "curriculum_name": curriculum["name"],
        "method": request.method,
    })
    summary_data = {
        "curriculum_id": request.curriculum_id,
        "curriculum_name": curriculum["name"],
        "topic_coverage": gap_results["topic_coverage"],
        "coverage_summary": gap_results["coverage_summary"],
        "course_coverage": gap_results["course_coverage"],
    }
    summary_json = json.dumps(summary_data)

    cursor.execute(
        """
        INSERT INTO analysis_history (analysis_type, parameters, results_summary, created_at)
        VALUES (?, ?, ?, ?)
        """,
        ("gap", params_json, summary_json, now_str),
    )
    analysis_id = cursor.lastrowid

    saved_recommendations: List[dict] = []
    for rec in recommendations_data:
        related_courses_json = json.dumps(rec.get("related_courses", []))
        cursor.execute(
            """
            INSERT INTO recommendations (analysis_id, type, related_courses, evidence, reason, suggested_action, priority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                rec["type"],
                related_courses_json,
                rec["evidence"],
                rec["reason"],
                rec["suggested_action"],
                rec.get("priority", "medium"),
                now_str,
            ),
        )
        rec_id = cursor.lastrowid
        saved_recommendations.append({
            "id": rec_id,
            "analysis_id": analysis_id,
            "type": rec["type"],
            "related_courses": rec.get("related_courses", []),
            "evidence": rec["evidence"],
            "reason": rec["reason"],
            "suggested_action": rec["suggested_action"],
            "priority": rec.get("priority", "medium"),
            "disclaimer": DISCLAIMER_TEXT,
            "created_at": now_str,
        })

    db.commit()

    return {
        "analysis_id": analysis_id,
        "curriculum_id": request.curriculum_id,
        "curriculum_name": curriculum["name"],
        "topic_coverage": gap_results["topic_coverage"],
        "coverage_summary": gap_results["coverage_summary"],
        "course_coverage": gap_results["course_coverage"],
        "recommendations": saved_recommendations,
    }


@router.get("/history", response_model=List[AnalysisHistoryResponse])
def get_analysis_history(db: sqlite3.Connection = Depends(get_db)):
    """Retrieve execution log history of all past analyses."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM analysis_history ORDER BY id DESC")
    rows = cursor.fetchall()

    history = []
    for r in rows:
        try:
            params = json.loads(r["parameters"])
        except Exception:
            params = {"raw": r["parameters"]}

        try:
            summary = json.loads(r["results_summary"])
        except Exception:
            summary = {"raw": r["results_summary"]}

        history.append({
            "id": r["id"],
            "analysis_type": r["analysis_type"],
            "parameters": params,
            "results_summary": summary,
            "created_at": r["created_at"],
        })
    return history


@router.get("/{analysis_id}")
def get_analysis_result(analysis_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Get full details and results of a specific historical analysis run."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM analysis_history WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=404, detail=f"Analysis run with ID {analysis_id} was not found."
        )

    try:
        params = json.loads(row["parameters"])
    except Exception:
        params = {"raw": row["parameters"]}

    try:
        summary = json.loads(row["results_summary"])
    except Exception:
        summary = {"raw": row["results_summary"]}

    # Fetch recommendations
    cursor.execute(
        "SELECT * FROM recommendations WHERE analysis_id = ? ORDER BY id ASC",
        (analysis_id,),
    )
    rec_rows = cursor.fetchall()
    recommendations = []
    for r in rec_rows:
        recommendations.append({
            "id": r["id"],
            "analysis_id": r["analysis_id"],
            "type": r["type"],
            "related_courses": _parse_related_courses(r["related_courses"]),
            "evidence": r["evidence"],
            "reason": r["reason"],
            "suggested_action": r["suggested_action"],
            "priority": r["priority"],
            "disclaimer": DISCLAIMER_TEXT,
            "created_at": r["created_at"],
        })

    return {
        "id": row["id"],
        "analysis_type": row["analysis_type"],
        "parameters": params,
        "results": summary,
        "recommendations": recommendations,
        "created_at": row["created_at"],
    }


@router.get("/recommendations/{analysis_id}", response_model=List[RecommendationItem])
def get_analysis_recommendations(
    analysis_id: int, db: sqlite3.Connection = Depends(get_db)
):
    """Retrieve all advisory recommendations associated with an analysis ID."""
    cursor = db.cursor()
    cursor.execute(
        "SELECT * FROM recommendations WHERE analysis_id = ? ORDER BY id ASC",
        (analysis_id,),
    )
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "analysis_id": r["analysis_id"],
            "type": r["type"],
            "related_courses": _parse_related_courses(r["related_courses"]),
            "evidence": r["evidence"],
            "reason": r["reason"],
            "suggested_action": r["suggested_action"],
            "priority": r["priority"] or "medium",
            "disclaimer": DISCLAIMER_TEXT,
            "created_at": r["created_at"],
        })
    return results


@router.get("/export/{analysis_id}")
def export_analysis_csv(analysis_id: int, db: sqlite3.Connection = Depends(get_db)):
    """Export analysis results formatted as a downloadable CSV spreadsheet."""
    cursor = db.cursor()
    cursor.execute("SELECT * FROM analysis_history WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=404, detail=f"Analysis run with ID {analysis_id} was not found."
        )

    analysis_type = row["analysis_type"]
    try:
        summary = json.loads(row["results_summary"])
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to parse stored analysis data.")

    output = io.StringIO()
    writer = csv.writer(output)

    if analysis_type == "similarity":
        writer.writerow([
            "Course 1 Code",
            "Course 1 Name",
            "Course 2 Code",
            "Course 2 Name",
            "Similarity Score",
            "Overlap Category",
            "Shared Key Terms",
        ])
        threshold = summary.get("threshold", 0.6)
        pairs = summary.get("ranked_pairs", [])
        for p in pairs:
            sim = p.get("similarity", 0.0)
            status = "High Overlap" if sim >= threshold else ("Moderate" if sim >= 0.3 else "Low")
            writer.writerow([
                p.get("course1", ""),
                p.get("course1_name", ""),
                p.get("course2", ""),
                p.get("course2_name", ""),
                f"{sim:.4f}",
                status,
                "; ".join(p.get("common_terms", [])),
            ])
        filename = f"similarity_analysis_{analysis_id}.csv"

    elif analysis_type == "gap":
        writer.writerow([
            "Reference Topic",
            "Coverage Status",
            "Coverage Score",
            "Covering Courses",
        ])
        topic_coverage = summary.get("topic_coverage", [])
        for item in topic_coverage:
            covering_str = "; ".join(
                [f"{c['course_id']} ({c['course_name']}: {c['relevance']})" for c in item.get("covered_by", [])]
            )
            writer.writerow([
                item.get("topic", ""),
                item.get("status", ""),
                f"{item.get('coverage_score', 0.0):.4f}",
                covering_str,
            ])
        filename = f"gap_analysis_{analysis_id}.csv"
    else:
        writer.writerow(["Key", "Value"])
        for k, v in summary.items():
            writer.writerow([k, str(v)])
        filename = f"analysis_{analysis_id}.csv"

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
