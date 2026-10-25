"""Curriculum gap analyzer comparing course contents against reference curricula."""
from typing import List, Dict, Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.nlp_engine import SimilarityEngine


class GapAnalyzer:
    def __init__(self, similarity_engine: SimilarityEngine = None):
        self.similarity_engine = similarity_engine or SimilarityEngine(load_model_on_init=False)

    def _prepare_course_text(self, course: Dict[str, Any]) -> str:
        """Combine course name, description, and syllabus topics into unified text."""
        parts = []
        name = course.get("name", "")
        if name:
            parts.append(name)

        desc = course.get("description", "")
        if desc:
            parts.append(desc)

        topics = course.get("syllabus_topics", [])
        if isinstance(topics, list):
            parts.append(" ".join(str(t) for t in topics))
        elif isinstance(topics, str):
            parts.append(topics)

        return " ".join(parts)

    def analyze_coverage(
        self,
        courses: List[Dict[str, Any]],
        reference_topics: List[str],
        method: str = "keyword",
    ) -> Dict[str, Any]:
        """Analyze which reference topics are covered by courses.

        Thresholds:
        - covered: similarity >= 0.3
        - partially_covered: similarity >= 0.15
        - not_covered: similarity < 0.15
        """
        # Edge Case: No reference topics
        if not reference_topics:
            return {
                "topic_coverage": [],
                "coverage_summary": {
                    "total_topics": 0,
                    "covered": 0,
                    "partially_covered": 0,
                    "not_covered": 0,
                    "coverage_percentage": 0.0,
                },
                "course_coverage": [
                    {
                        "course_id": str(c.get("course_id", "")),
                        "course_name": str(c.get("name", "")),
                        "topics_covered": [],
                        "coverage_count": 0,
                    }
                    for c in courses
                ],
            }

        # Edge Case: No courses available
        if not courses:
            topic_coverage = [
                {
                    "topic": topic,
                    "status": "not_covered",
                    "coverage_score": 0.0,
                    "covered_by": [],
                }
                for topic in reference_topics
            ]
            return {
                "topic_coverage": topic_coverage,
                "coverage_summary": {
                    "total_topics": len(reference_topics),
                    "covered": 0,
                    "partially_covered": 0,
                    "not_covered": len(reference_topics),
                    "coverage_percentage": 0.0,
                },
                "course_coverage": [],
            }

        course_texts = [self._prepare_course_text(c) for c in courses]
        course_ids = [str(c.get("course_id", f"C{i+1}")) for i, c in enumerate(courses)]
        course_names = [str(c.get("name", "Course")) for c in courses]

        # Clean texts
        cleaned_courses = [self.similarity_engine.preprocess_text(t) for t in course_texts]
        cleaned_topics = [self.similarity_engine.preprocess_text(t) for t in reference_topics]

        # Check semantic method availability
        use_semantic = (
            method.lower() == "semantic"
            and self.similarity_engine.semantic_available
            and self.similarity_engine.semantic_model is not None
        )

        num_topics = len(reference_topics)
        num_courses = len(courses)
        topic_course_matrix = np.zeros((num_topics, num_courses), dtype=float)

        if use_semantic:
            try:
                topic_embs = self.similarity_engine.semantic_model.encode(
                    reference_topics, convert_to_numpy=True, show_progress_bar=False
                )
                course_embs = self.similarity_engine.semantic_model.encode(
                    course_texts, convert_to_numpy=True, show_progress_bar=False
                )
                topic_course_matrix = cosine_similarity(topic_embs, course_embs)
            except Exception:
                use_semantic = False

        if not use_semantic:
            # TF-IDF across all topics and courses
            all_documents = cleaned_courses + cleaned_topics
            vectorizer = TfidfVectorizer(
                stop_words="english",
                ngram_range=(1, 2),
                sublinear_tf=True,
                token_pattern=r"(?u)\b[a-zA-Z0-9_]{2,}\b",
            )
            try:
                tfidf_all = vectorizer.fit_transform(all_documents)
                courses_vec = tfidf_all[:num_courses]
                topics_vec = tfidf_all[num_courses:]
                topic_course_matrix = cosine_similarity(topics_vec, courses_vec)
            except ValueError:
                topic_course_matrix = np.zeros((num_topics, num_courses), dtype=float)

        # Clip bounds to [0, 1]
        topic_course_matrix = np.clip(topic_course_matrix, 0.0, 1.0)

        # Build topic coverage and track which course covers which topics
        topic_coverage = []
        course_to_topics_map = {cid: [] for cid in course_ids}

        covered_count = 0
        partially_covered_count = 0
        not_covered_count = 0

        for t_idx, topic in enumerate(reference_topics):
            topic_scores = topic_course_matrix[t_idx]
            max_score = float(np.max(topic_scores)) if len(topic_scores) > 0 else 0.0

            # Find matching courses
            matches = []
            for c_idx, score in enumerate(topic_scores):
                rel = float(score)
                # Boost if exact topic name appears in course text
                exact_phrase = topic.lower()
                if exact_phrase in course_texts[c_idx].lower():
                    rel = max(rel, 0.5)
                    max_score = max(max_score, rel)

                if rel >= 0.15:
                    matches.append({
                        "course_id": course_ids[c_idx],
                        "course_name": course_names[c_idx],
                        "relevance": round(rel, 4),
                    })
                    course_to_topics_map[course_ids[c_idx]].append(topic)

            matches.sort(key=lambda m: m["relevance"], reverse=True)

            if max_score >= 0.30:
                status = "covered"
                covered_count += 1
            elif max_score >= 0.15:
                status = "partially_covered"
                partially_covered_count += 1
            else:
                status = "not_covered"
                not_covered_count += 1

            topic_coverage.append({
                "topic": topic,
                "status": status,
                "coverage_score": round(max_score, 4),
                "covered_by": matches,
            })

        coverage_percentage = (
            round((covered_count / num_topics) * 100, 2) if num_topics > 0 else 0.0
        )

        coverage_summary = {
            "total_topics": num_topics,
            "covered": covered_count,
            "partially_covered": partially_covered_count,
            "not_covered": not_covered_count,
            "coverage_percentage": coverage_percentage,
        }

        course_coverage = [
            {
                "course_id": cid,
                "course_name": cname,
                "topics_covered": course_to_topics_map[cid],
                "coverage_count": len(course_to_topics_map[cid]),
            }
            for cid, cname in zip(course_ids, course_names)
        ]

        return {
            "topic_coverage": topic_coverage,
            "coverage_summary": coverage_summary,
            "course_coverage": course_coverage,
        }
