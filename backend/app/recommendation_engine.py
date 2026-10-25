"""Recommendation engine generating academic advisory insights from analysis results."""
from typing import List, Dict, Any, Optional

DISCLAIMER_TEXT = (
    "Note: This is an AI-generated suggestion based on text similarity analysis. "
    "It requires academic review and should not be treated as a final curriculum decision."
)


class RecommendationEngine:
    def generate_recommendations(
        self,
        similarity_results: Optional[Dict[str, Any]] = None,
        gap_results: Optional[Dict[str, Any]] = None,
        threshold: float = 0.6,
    ) -> List[Dict[str, Any]]:
        """Generate actionable recommendations from similarity and gap analysis results.

        Each recommendation schema:
        {
            'type': 'high_overlap' | 'missing_topic' | 'partial_coverage' | 'course_sequencing',
            'related_courses': [str],
            'evidence': str,
            'reason': str,
            'suggested_action': str,
            'priority': 'high' | 'medium' | 'low',
            'disclaimer': str
        }
        """
        recommendations: List[Dict[str, Any]] = []

        # 1. Evaluate Similarity Results
        if similarity_results:
            high_overlap_pairs = similarity_results.get("high_overlap_pairs", [])
            ranked_pairs = similarity_results.get("ranked_pairs", [])

            # High overlap recommendations
            for pair in high_overlap_pairs:
                c1 = pair.get("course1", "")
                c2 = pair.get("course2", "")
                name1 = pair.get("course1_name", c1)
                name2 = pair.get("course2_name", c2)
                sim = pair.get("similarity", 0.0)
                common = pair.get("common_terms", [])
                common_str = ", ".join(common) if common else "foundational subject terminology"

                priority = "high" if sim >= 0.70 else "medium"

                recommendations.append({
                    "type": "high_overlap",
                    "related_courses": [c1, c2],
                    "evidence": (
                        f"{c1} ({name1}) and {c2} ({name2}) share an estimated {sim * 100:.1f}% "
                        f"content overlap. Prominent intersecting topics include: {common_str}."
                    ),
                    "reason": (
                        "Substantial thematic overlap risks instructional redundancy, "
                        "student disengagement, and inefficient faculty resource utilization."
                    ),
                    "suggested_action": (
                        f"Review syllabi of {c1} and {c2} to establish clearer boundaries. "
                        "Consider merging overlapping modules or repositioning one course as an advanced prerequisite-dependent elective."
                    ),
                    "priority": priority,
                    "disclaimer": DISCLAIMER_TEXT,
                })

            # Check potential sequencing issues among moderate-to-high overlap courses
            sequencing_checked = set()
            for pair in ranked_pairs:
                sim = pair.get("similarity", 0.0)
                c1 = pair.get("course1", "")
                c2 = pair.get("course2", "")
                pair_key = tuple(sorted([c1, c2]))

                # If similarity is between 0.40 and 0.65, examine conceptual progression
                if 0.40 <= sim < 0.65 and pair_key not in sequencing_checked:
                    sequencing_checked.add(pair_key)
                    c1_name = pair.get("course1_name", c1)
                    c2_name = pair.get("course2_name", c2)
                    common = pair.get("common_terms", [])
                    common_str = ", ".join(common[:3]) if common else "core methodologies"

                    recommendations.append({
                        "type": "course_sequencing",
                        "related_courses": [c1, c2],
                        "evidence": (
                            f"Moderate topical alignment ({sim * 100:.1f}%) detected between "
                            f"{c1} and {c2} surrounding {common_str}."
                        ),
                        "reason": (
                            "Sequential concepts taught across different semesters should maintain "
                            "a deliberate progression from theoretical foundations to specialized application."
                        ),
                        "suggested_action": (
                            f"Confirm proper prerequisite ordering between {c1} and {c2} "
                            "to ensure students possess required background before encountering shared topics."
                        ),
                        "priority": "low",
                        "disclaimer": DISCLAIMER_TEXT,
                    })
                    # Limit sequencing recommendations to top 2 to avoid clutter
                    if len([r for r in recommendations if r["type"] == "course_sequencing"]) >= 2:
                        break

        # 2. Evaluate Gap Results
        if gap_results:
            topic_coverage = gap_results.get("topic_coverage", [])

            for item in topic_coverage:
                topic = item.get("topic", "")
                status = item.get("status", "")
                score = item.get("coverage_score", 0.0)
                covered_by = item.get("covered_by", [])
                course_ids = [m.get("course_id", "") for m in covered_by if m.get("course_id")]

                if status == "not_covered":
                    recommendations.append({
                        "type": "missing_topic",
                        "related_courses": [],
                        "evidence": (
                            f"Reference curriculum topic '{topic}' has negligible representation "
                            f"(similarity score: {score:.2f}) across all evaluated courses."
                        ),
                        "reason": (
                            "Absence of this benchmark topic creates an educational gap relative "
                            "to target curriculum standards and industry requirements."
                        ),
                        "suggested_action": (
                            f"Design a dedicated unit on '{topic}' to be integrated into an existing course, "
                            f"or introduce a new elective covering this subject area."
                        ),
                        "priority": "high",
                        "disclaimer": DISCLAIMER_TEXT,
                    })
                elif status == "partially_covered":
                    courses_str = ", ".join(course_ids) if course_ids else "existing offerings"
                    recommendations.append({
                        "type": "partial_coverage",
                        "related_courses": course_ids,
                        "evidence": (
                            f"Topic '{topic}' is only partially covered (coverage score: {score:.2f}) "
                            f"in courses: {courses_str}."
                        ),
                        "reason": (
                            "Limited or introductory treatment may leave students without adequate "
                            "practical depth or formal assessment in this competency."
                        ),
                        "suggested_action": (
                            f"Expand syllabus learning objectives for '{topic}' within {courses_str} "
                            "to include hands-on project work and deeper theoretical analysis."
                        ),
                        "priority": "medium",
                        "disclaimer": DISCLAIMER_TEXT,
                    })

        # Ensure every single recommendation has the required disclaimer
        for r in recommendations:
            r["disclaimer"] = DISCLAIMER_TEXT

        return recommendations
