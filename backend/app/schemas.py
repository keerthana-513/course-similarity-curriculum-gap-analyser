"""Pydantic schemas and request/response models."""
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


# Course Schemas
class CourseBase(BaseModel):
    course_id: str = Field(..., description="Unique course identifier, e.g. CS101")
    name: str = Field(..., description="Course title")
    department: str = Field(..., description="Department or division")
    semester: str = Field(..., description="Semester offering, e.g. Semester 1")
    description: str = Field(..., description="Course catalog description")
    syllabus_topics: Union[List[str], str] = Field(
        ..., description="List of topics or comma/newline separated topic list"
    )


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    description: Optional[str] = None
    syllabus_topics: Optional[Union[List[str], str]] = None


class CourseResponse(BaseModel):
    id: int
    course_id: str
    name: str
    department: str
    semester: str
    description: str
    syllabus_topics: List[str]
    created_at: str
    updated_at: str


# Reference Curriculum Schemas
class ReferenceCurriculumBase(BaseModel):
    name: str = Field(..., description="Curriculum title")
    department: str = Field(..., description="Target department or domain")
    topics: List[str] = Field(..., description="Benchmark topics to evaluate against")


class ReferenceCurriculumCreate(ReferenceCurriculumBase):
    pass


class ReferenceCurriculumUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    topics: Optional[List[str]] = None


class ReferenceCurriculumResponse(BaseModel):
    id: int
    name: str
    department: str
    topics: List[str]
    created_at: str


# Recommendation Schema
class RecommendationItem(BaseModel):
    id: Optional[int] = None
    analysis_id: Optional[int] = None
    type: str = Field(
        ...,
        description="'high_overlap' | 'missing_topic' | 'partial_coverage' | 'course_sequencing'",
    )
    related_courses: List[str] = Field(default_factory=list)
    evidence: str
    reason: str
    suggested_action: str
    priority: str = Field(default="medium", description="'high' | 'medium' | 'low'")
    disclaimer: str = (
        "Note: This is an AI-generated suggestion based on text similarity analysis. "
        "It requires academic review and should not be treated as a final curriculum decision."
    )
    created_at: Optional[str] = None


# Similarity Analysis Schemas
class SimilarityAnalysisRequest(BaseModel):
    method: str = Field(default="tfidf", description="'tfidf' or 'semantic'")
    threshold: float = Field(default=0.6, ge=0.0, le=1.0, description="Overlap threshold (0-1)")


class SimilarityPair(BaseModel):
    course1: str
    course2: str
    course1_name: Optional[str] = ""
    course2_name: Optional[str] = ""
    similarity: float
    common_terms: List[str] = Field(default_factory=list)


class SimilarityAnalysisResponse(BaseModel):
    analysis_id: Optional[int] = None
    method: str
    threshold: float
    similarity_matrix: List[List[float]]
    course_labels: List[str]
    course_ids: List[str]
    ranked_pairs: List[SimilarityPair]
    high_overlap_pairs: List[SimilarityPair]
    recommendations: List[RecommendationItem] = Field(default_factory=list)


# Gap Analysis Schemas
class GapAnalysisRequest(BaseModel):
    curriculum_id: int
    method: str = Field(default="keyword", description="'keyword' or 'semantic'")


class CourseMatch(BaseModel):
    course_id: str
    course_name: str
    relevance: float


class TopicCoverageItem(BaseModel):
    topic: str
    status: str = Field(
        ..., description="'covered' | 'partially_covered' | 'not_covered'"
    )
    coverage_score: float
    covered_by: List[CourseMatch] = Field(default_factory=list)


class CoverageSummary(BaseModel):
    total_topics: int
    covered: int
    partially_covered: int
    not_covered: int
    coverage_percentage: float


class CourseCoverageSummary(BaseModel):
    course_id: str
    course_name: str
    topics_covered: List[str] = Field(default_factory=list)
    coverage_count: int


class GapAnalysisResponse(BaseModel):
    analysis_id: Optional[int] = None
    curriculum_id: int
    curriculum_name: str
    topic_coverage: List[TopicCoverageItem]
    coverage_summary: CoverageSummary
    course_coverage: List[CourseCoverageSummary]
    recommendations: List[RecommendationItem] = Field(default_factory=list)


# Analysis History Schemas
class AnalysisHistoryResponse(BaseModel):
    id: int
    analysis_type: str
    parameters: Dict[str, Any]
    results_summary: Dict[str, Any]
    created_at: str


# Status / Health Schemas
class HealthResponse(BaseModel):
    status: str
    database: str


class EngineStatusResponse(BaseModel):
    semantic_available: bool
    default_method: str
    models_loaded: List[str]
