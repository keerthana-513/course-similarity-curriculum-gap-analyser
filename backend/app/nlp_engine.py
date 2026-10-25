"""NLP similarity engine for Course Description Similarity & Gap Analyzer."""
import re
import string
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class SimilarityEngine:
    def __init__(self, load_model_on_init: bool = True):
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.semantic_model = None
        self.semantic_available: bool = False
        if load_model_on_init:
            self._try_load_semantic_model()

    def _try_load_semantic_model(self) -> None:
        """Try to load sentence-transformers model, fallback to TF-IDF only."""
        try:
            from sentence_transformers import SentenceTransformer
            self.semantic_model = SentenceTransformer("all-MiniLM-L6-v2")
            self.semantic_available = True
        except Exception:
            self.semantic_model = None
            self.semantic_available = False

    def preprocess_text(self, text: str) -> str:
        """Normalize and clean text."""
        if not text:
            return ""
        # Lowercase
        cleaned = text.lower()
        # Remove URLs and email addresses if any
        cleaned = re.sub(r"https?://\S+|www\.\S+", " ", cleaned)
        cleaned = re.sub(r"\S+@\S+", " ", cleaned)
        # Keep alphanumeric, hyphens, and spaces
        cleaned = re.sub(r"[^a-zA-Z0-9\s\-]", " ", cleaned)
        # Replace hyphens with spaces for token splitting while preserving words
        cleaned = cleaned.replace("-", " ")
        # Consolidate whitespace
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned

    def compute_tfidf_similarity(self, texts: List[str]) -> np.ndarray:
        """Compute pairwise cosine similarity matrix using TF-IDF."""
        if not texts:
            return np.zeros((0, 0), dtype=float)

        preprocessed = [self.preprocess_text(t) for t in texts]

        # Handle case where all texts are empty
        if not any(preprocessed):
            n = len(texts)
            matrix = np.zeros((n, n), dtype=float)
            np.fill_diagonal(matrix, 1.0)
            return matrix

        # Custom vectorizer with english stop words and ngram range (1, 2)
        vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
            token_pattern=r"(?u)\b[a-zA-Z0-9_]{2,}\b",
        )

        try:
            tfidf_matrix = vectorizer.fit_transform(preprocessed)
            sim_matrix = cosine_similarity(tfidf_matrix)
        except ValueError:
            # Fallback if no valid vocabulary (e.g. only stopwords)
            n = len(texts)
            sim_matrix = np.eye(n, dtype=float)

        # Clip values to [0.0, 1.0] and ensure diagonal is exactly 1.0
        sim_matrix = np.clip(sim_matrix, 0.0, 1.0)
        np.fill_diagonal(sim_matrix, 1.0)
        return sim_matrix

    def compute_semantic_similarity(self, texts: List[str]) -> np.ndarray:
        """Compute pairwise cosine similarity using sentence-transformers model."""
        if not texts:
            return np.zeros((0, 0), dtype=float)

        if not self.semantic_available or self.semantic_model is None:
            # Fallback smoothly to TF-IDF
            return self.compute_tfidf_similarity(texts)

        try:
            embeddings = self.semantic_model.encode(
                texts, convert_to_numpy=True, show_progress_bar=False
            )
            sim_matrix = cosine_similarity(embeddings)
            sim_matrix = np.clip(sim_matrix, 0.0, 1.0)
            np.fill_diagonal(sim_matrix, 1.0)
            return sim_matrix
        except Exception:
            # Fallback to TF-IDF on error
            return self.compute_tfidf_similarity(texts)

    def get_common_terms(self, text1: str, text2: str, top_n: int = 10) -> List[str]:
        """Extract common important terms between two texts using TF-IDF."""
        clean1 = self.preprocess_text(text1)
        clean2 = self.preprocess_text(text2)

        if not clean1 or not clean2:
            return []

        try:
            vec = TfidfVectorizer(
                stop_words="english",
                token_pattern=r"(?u)\b[a-zA-Z]{3,}\b",
                ngram_range=(1, 2),
            )
            matrix = vec.fit_transform([clean1, clean2])
            feature_names = vec.get_feature_names_out()

            row1 = matrix.getrow(0).toarray()[0]
            row2 = matrix.getrow(1).toarray()[0]

            # Common terms must have non-zero weight in both documents
            common_scores = {}
            for idx, feature in enumerate(feature_names):
                w1 = row1[idx]
                w2 = row2[idx]
                if w1 > 0 and w2 > 0:
                    # Harmonic or geometric product to balance importance in both
                    common_scores[feature] = (2 * w1 * w2) / (w1 + w2)

            if common_scores:
                sorted_terms = sorted(
                    common_scores.items(), key=lambda item: item[1], reverse=True
                )
                return [term for term, _ in sorted_terms[:top_n]]
        except Exception:
            pass

        # Fallback to token set intersection
        tokens1 = set(clean1.split())
        tokens2 = set(clean2.split())
        stop_words = {
            "the", "and", "is", "in", "to", "of", "with", "for", "on", "as",
            "at", "by", "an", "this", "that", "these", "those", "are", "be",
            "from", "into", "using", "course", "students", "will", "learn"
        }
        common = [t for t in (tokens1 & tokens2) if len(t) > 3 and t not in stop_words]
        return sorted(common)[:top_n]

    def _prepare_course_text(self, course: Dict[str, Any]) -> str:
        """Combine course name, description, and syllabus topics into a unified text.

        Syllabus topics are repeated to boost their weight in TF-IDF, since they
        are the most representative signal of a course's actual content.
        """
        parts = []
        name = course.get("name", "")
        if name:
            parts.append(name)
            parts.append(name)  # boost course title

        desc = course.get("description", "")
        if desc:
            parts.append(desc)

        topics = course.get("syllabus_topics", [])
        if isinstance(topics, list):
            topic_text = " ".join(str(t) for t in topics)
        elif isinstance(topics, str):
            topic_text = topics
        else:
            topic_text = ""

        if topic_text:
            # Triple-weight syllabus topics — they are the core content signal
            parts.append(topic_text)
            parts.append(topic_text)
            parts.append(topic_text)

        return " ".join(parts)

    def analyze_courses(
        self, courses: List[Dict[str, Any]], method: str = "tfidf", threshold: float = 0.6
    ) -> Dict[str, Any]:
        """Main analysis function.

        Returns:
        {
            'similarity_matrix': [[float]],
            'course_labels': [str],
            'course_ids': [str],
            'ranked_pairs': [{'course1': str, 'course2': str, 'course1_name': str, 'course2_name': str, 'similarity': float, 'common_terms': [str]}],
            'high_overlap_pairs': [same as above but filtered by threshold],
            'method': str,
            'threshold': float
        }
        """
        # Edge Case: Empty course list
        if not courses:
            return {
                "similarity_matrix": [],
                "course_labels": [],
                "course_ids": [],
                "ranked_pairs": [],
                "high_overlap_pairs": [],
                "method": method,
                "threshold": threshold,
            }

        course_ids = [str(c.get("course_id", f"C{i+1}")) for i, c in enumerate(courses)]
        course_names = [str(c.get("name", "Untitled Course")) for c in courses]
        course_labels = [f"{cid}: {cname}" for cid, cname in zip(course_ids, course_names)]
        texts = [self._prepare_course_text(c) for c in courses]

        # Edge Case: Single course
        if len(courses) == 1:
            return {
                "similarity_matrix": [[1.0]],
                "course_labels": course_labels,
                "course_ids": course_ids,
                "ranked_pairs": [],
                "high_overlap_pairs": [],
                "method": method,
                "threshold": threshold,
            }

        # Choose calculation method
        actual_method = method.lower()
        if actual_method == "semantic" and self.semantic_available:
            sim_matrix = self.compute_semantic_similarity(texts)
        else:
            sim_matrix = self.compute_tfidf_similarity(texts)
            if actual_method == "semantic" and not self.semantic_available:
                actual_method = "tfidf (fallback)"

        n = len(courses)
        ranked_pairs: List[Dict[str, Any]] = []

        for i in range(n):
            for j in range(i + 1, n):
                score = float(sim_matrix[i][j])
                common = self.get_common_terms(texts[i], texts[j], top_n=6)
                ranked_pairs.append({
                    "course1": course_ids[i],
                    "course2": course_ids[j],
                    "course1_name": course_names[i],
                    "course2_name": course_names[j],
                    "similarity": round(score, 4),
                    "common_terms": common,
                })

        # Sort pairs descending by similarity score
        ranked_pairs.sort(key=lambda x: x["similarity"], reverse=True)

        # High overlap filtered by threshold
        high_overlap_pairs = [p for p in ranked_pairs if p["similarity"] >= threshold]

        # Convert numpy matrix to float list with rounding
        matrix_list = [[round(float(val), 4) for val in row] for row in sim_matrix]

        return {
            "similarity_matrix": matrix_list,
            "course_labels": course_labels,
            "course_ids": course_ids,
            "ranked_pairs": ranked_pairs,
            "high_overlap_pairs": high_overlap_pairs,
            "method": actual_method,
            "threshold": threshold,
        }
