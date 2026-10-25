import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import numpy as np
from app.nlp_engine import SimilarityEngine
from app.gap_analyzer import GapAnalyzer
from app.recommendation_engine import RecommendationEngine, DISCLAIMER_TEXT


@pytest.fixture
def similarity_engine():
    """Fixture providing a fast-initializing SimilarityEngine without waiting for transformer model."""
    return SimilarityEngine(load_model_on_init=False)


@pytest.fixture
def gap_analyzer(similarity_engine):
    """Fixture providing GapAnalyzer configured with the test similarity engine."""
    return GapAnalyzer(similarity_engine=similarity_engine)


@pytest.fixture
def recommendation_engine():
    """Fixture providing RecommendationEngine."""
    return RecommendationEngine()


@pytest.fixture
def sample_test_courses():
    """Fixture providing sample courses with known degrees of overlap."""
    return [
        {
            "course_id": "DS301",
            "name": "Machine Learning Fundamentals",
            "department": "Data Science",
            "semester": "Semester 5",
            "description": (
                "Supervised and unsupervised machine learning algorithms. "
                "Covers linear regression, logistic regression, decision trees, "
                "cross-validation, and model evaluation metrics."
            ),
            "syllabus_topics": [
                "Supervised Learning",
                "Linear Regression",
                "Logistic Regression",
                "Decision Trees",
                "Model Evaluation",
            ],
        },
        {
            "course_id": "ML101",
            "name": "Applied Machine Learning",
            "department": "Machine Learning",
            "semester": "Semester 3",
            "description": (
                "Applied machine learning methods for classification and prediction. "
                "Linear regression, logistic regression, decision tree classifiers, "
                "cross-validation, and hyperparameter tuning."
            ),
            "syllabus_topics": [
                "Supervised Learning",
                "Linear Regression",
                "Logistic Regression",
                "Classification",
                "Model Evaluation",
            ],
        },
        {
            "course_id": "CS401",
            "name": "Software Engineering",
            "department": "Computer Science",
            "semester": "Semester 7",
            "description": (
                "Software development lifecycles, Agile and Scrum methodologies. "
                "Requirements engineering, architectural design patterns, unit testing, "
                "and continuous integration pipelines."
            ),
            "syllabus_topics": [
                "Agile Methodologies",
                "Requirements Engineering",
                "Design Patterns",
                "Unit Testing",
                "CI/CD Pipelines",
            ],
        },
    ]


# Test 1: Preprocessing Text Normalization
def test_preprocess_text(similarity_engine):
    raw_text = "   Introduction to PYTHON Programming! Visit https://example.com/python or email test@uni.edu...   "
    cleaned = similarity_engine.preprocess_text(raw_text)
    assert "https" not in cleaned
    assert "test@uni.edu" not in cleaned
    assert "python" in cleaned
    assert "introduction" in cleaned
    assert "!" not in cleaned
    # Ensure extra spaces were collapsed
    assert "  " not in cleaned


# Test 2: TF-IDF Pairwise Similarity Matrix Properties
def test_compute_tfidf_similarity_matrix_properties(similarity_engine):
    texts = [
        "Machine learning algorithms and neural networks for classification",
        "Deep neural networks and machine learning models for predictive analysis",
        "Ancient history of civil engineering and stone bridge construction",
    ]
    matrix = similarity_engine.compute_tfidf_similarity(texts)

    # Check matrix shape (3x3)
    assert isinstance(matrix, np.ndarray)
    assert matrix.shape == (3, 3)

    # Diagonal must be 1.0 (self-similarity)
    for i in range(3):
        assert pytest.approx(matrix[i, i], 0.001) == 1.0

    # Symmetric matrix property
    assert pytest.approx(matrix[0, 1], 0.001) == matrix[1, 0]
    assert pytest.approx(matrix[0, 2], 0.001) == matrix[2, 0]

    # First two related texts should have noticeably higher similarity than with ancient history
    assert matrix[0, 1] > matrix[0, 2]
    assert matrix[1, 0] > matrix[1, 2]


# Test 3: Empty Course List Handling
def test_similarity_empty_input(similarity_engine):
    result = similarity_engine.analyze_courses([])
    assert result["similarity_matrix"] == []
    assert result["course_labels"] == []
    assert result["course_ids"] == []
    assert result["ranked_pairs"] == []
    assert result["high_overlap_pairs"] == []


# Test 4: Single Course Input Handling
def test_similarity_single_course(similarity_engine):
    single = [{
        "course_id": "CS101",
        "name": "Python Programming",
        "description": "Learn python coding.",
        "syllabus_topics": ["Variables", "Loops"],
    }]
    result = similarity_engine.analyze_courses(single)
    assert len(result["similarity_matrix"]) == 1
    assert result["similarity_matrix"][0][0] == 1.0
    assert result["course_ids"] == ["CS101"]
    assert result["ranked_pairs"] == []
    assert result["high_overlap_pairs"] == []


# Test 5: Overlap Calculation between Similar vs Dissimilar Courses
def test_high_overlap_vs_low_overlap(similarity_engine, sample_test_courses):
    result = similarity_engine.analyze_courses(sample_test_courses, threshold=0.5)

    pairs_dict = {
        (p["course1"], p["course2"]): p["similarity"]
        for p in result["ranked_pairs"]
    }

    # DS301 and ML101 should have substantial similarity
    ml_ds_similarity = pairs_dict.get(("DS301", "ML101")) or pairs_dict.get(("ML101", "DS301"))
    # DS301 and CS401 should have low similarity
    cs_ds_similarity = pairs_dict.get(("DS301", "CS401")) or pairs_dict.get(("CS401", "DS301"))

    assert ml_ds_similarity is not None
    assert cs_ds_similarity is not None
    assert ml_ds_similarity > cs_ds_similarity
    assert ml_ds_similarity > 0.40


# Test 6: Threshold Filtering in Analyze Courses
def test_threshold_filtering(similarity_engine, sample_test_courses):
    strict_res = similarity_engine.analyze_courses(sample_test_courses, threshold=0.85)
    lenient_res = similarity_engine.analyze_courses(sample_test_courses, threshold=0.10)

    # Lenient threshold should yield more or equal high-overlap pairs than strict threshold
    assert len(lenient_res["high_overlap_pairs"]) >= len(strict_res["high_overlap_pairs"])
    for pair in strict_res["high_overlap_pairs"]:
        assert pair["similarity"] >= 0.85


# Test 7: Common Terms Extraction
def test_get_common_terms(similarity_engine):
    text1 = "Introduction to linear regression, logistic classification, and decision tree models."
    text2 = "Advanced study of decision tree algorithms, classification models, and neural nets."
    terms = similarity_engine.get_common_terms(text1, text2, top_n=5)

    assert isinstance(terms, list)
    assert len(terms) > 0
    # Both texts discuss decision trees and classification
    assert any("decision" in t or "classification" in t or "tree" in t or "models" in t for t in terms)


# Test 8: Courses with Empty / Whitespace Descriptions
def test_courses_with_empty_or_sparse_descriptions(similarity_engine):
    sparse_courses = [
        {"course_id": "C1", "name": "Course One", "description": "", "syllabus_topics": []},
        {"course_id": "C2", "name": "", "description": "   ", "syllabus_topics": []},
    ]
    # Should not raise exception
    res = similarity_engine.analyze_courses(sparse_courses)
    assert len(res["similarity_matrix"]) == 2
    assert res["similarity_matrix"][0][0] == 1.0


# Test 9: Gap Analysis Coverage Detection
def test_gap_analysis_coverage(gap_analyzer, sample_test_courses):
    reference_topics = [
        "Supervised Learning",
        "Software Engineering",
        "Quantum Computing",
    ]

    gap_result = gap_analyzer.analyze_coverage(sample_test_courses, reference_topics)
    assert "topic_coverage" in gap_result
    assert "coverage_summary" in gap_result
    assert "course_coverage" in gap_result

    coverage_map = {item["topic"]: item["status"] for item in gap_result["topic_coverage"]}

    # 'Supervised Learning' is covered by DS301 and ML101
    assert coverage_map["Supervised Learning"] in ["covered", "partially_covered"]
    # 'Quantum Computing' is not in any course
    assert coverage_map["Quantum Computing"] == "not_covered"

    summary = gap_result["coverage_summary"]
    assert summary["total_topics"] == 3
    assert summary["not_covered"] >= 1
    assert 0.0 <= summary["coverage_percentage"] <= 100.0


# Test 10: Gap Analysis with Empty Inputs
def test_gap_analysis_empty_inputs(gap_analyzer, sample_test_courses):
    # Empty reference topics
    res_no_topics = gap_analyzer.analyze_coverage(sample_test_courses, [])
    assert res_no_topics["topic_coverage"] == []
    assert res_no_topics["coverage_summary"]["total_topics"] == 0

    # Empty courses
    res_no_courses = gap_analyzer.analyze_coverage([], ["Topic A", "Topic B"])
    assert len(res_no_courses["topic_coverage"]) == 2
    for item in res_no_courses["topic_coverage"]:
        assert item["status"] == "not_covered"
        assert item["coverage_score"] == 0.0


# Test 11: Recommendation Generation for High Overlap Pairs
def test_recommendation_generation_high_overlap(similarity_engine, recommendation_engine, sample_test_courses):
    sim_results = similarity_engine.analyze_courses(sample_test_courses, threshold=0.40)
    recs = recommendation_engine.generate_recommendations(similarity_results=sim_results, threshold=0.40)

    overlap_recs = [r for r in recs if r["type"] == "high_overlap"]
    assert len(overlap_recs) > 0

    first_rec = overlap_recs[0]
    assert "related_courses" in first_rec
    assert len(first_rec["related_courses"]) == 2
    assert "evidence" in first_rec
    assert "reason" in first_rec
    assert "suggested_action" in first_rec
    assert first_rec["priority"] in ["high", "medium", "low"]


# Test 12: Recommendation Generation for Gap Topics
def test_recommendation_generation_gap_topics(gap_analyzer, recommendation_engine, sample_test_courses):
    reference_topics = ["Cloud Computing", "Reinforcement Learning"]
    gap_res = gap_analyzer.analyze_coverage(sample_test_courses, reference_topics)
    recs = recommendation_engine.generate_recommendations(gap_results=gap_res)

    missing_recs = [r for r in recs if r["type"] == "missing_topic"]
    assert len(missing_recs) == 2
    for r in missing_recs:
        assert r["priority"] == "high"
        assert "evidence" in r
        assert "suggested_action" in r


# Test 13: Mandatory AI Academic Disclaimer on Every Recommendation
def test_mandatory_ai_disclaimer_presence(similarity_engine, gap_analyzer, recommendation_engine, sample_test_courses):
    sim_res = similarity_engine.analyze_courses(sample_test_courses, threshold=0.30)
    gap_res = gap_analyzer.analyze_coverage(sample_test_courses, ["Robotics Architecture"])
    recs = recommendation_engine.generate_recommendations(
        similarity_results=sim_res, gap_results=gap_res, threshold=0.30
    )

    assert len(recs) > 0
    for r in recs:
        assert "disclaimer" in r
        assert r["disclaimer"] == DISCLAIMER_TEXT
        assert "academic review" in r["disclaimer"].lower()
