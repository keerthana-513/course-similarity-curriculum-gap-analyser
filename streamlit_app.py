"""
Course Description Similarity & Curriculum Gap Analyzer
Streamlit Cloud deployment - single-file app wrapping the NLP pipeline.
"""
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Default overlap threshold (matches the project report: 0.6)
DEFAULT_THRESHOLD = 0.60

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Course Similarity & Gap Analyzer",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ──────────────────────────────────────────────────────────
# Database helpers (SQLite for Streamlit Cloud)
# ──────────────────────────────────────────────────────────
DB_PATH = Path("courses.db")


def get_conn():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        department TEXT DEFAULT '',
        semester TEXT DEFAULT '',
        description TEXT DEFAULT '',
        syllabus_topics TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reference_curricula (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department TEXT DEFAULT '',
        topics TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)
    conn.commit()
    conn.close()


init_db()

# ──────────────────────────────────────────────────────────
# Sample Data
# ──────────────────────────────────────────────────────────
SAMPLE_COURSES = [
    {"course_id": "CS101", "name": "Introduction to Python Programming", "department": "Computer Science", "semester": "Semester 1",
     "description": "Comprehensive introduction to programming using Python. Covers variables, control flow, functions, data structures, file I/O, and basic OOP.",
     "syllabus_topics": ["Python Programming Syntax", "Control Flow", "Functions", "Data Structures: Lists, Tuples, Dicts", "File Handling", "OOP Basics", "Algorithm Implementation", "Exception Handling"]},
    {"course_id": "CS201", "name": "Data Structures and Algorithms", "department": "Computer Science", "semester": "Semester 3",
     "description": "In-depth study of abstract data types, sorting, searching, trees, graphs, and algorithmic complexity with Big-O notation.",
     "syllabus_topics": ["Big-O Notation", "Arrays and Linked Lists", "Stacks and Queues", "Binary Search Trees", "Heaps", "Sorting Algorithms", "Graph Traversals BFS DFS", "Dynamic Programming"]},
    {"course_id": "CS301", "name": "Database Management Systems", "department": "Computer Science", "semester": "Semester 5",
     "description": "Database design, relational algebra, SQL, normalization, indexing, query optimization, and transaction management.",
     "syllabus_topics": ["Database Architecture", "Relational Model", "SQL", "ER Modeling and Normalization", "Indexing and B-Trees", "Query Optimization", "ACID Transactions", "Concurrency Control"]},
    {"course_id": "DS101", "name": "Statistics and Probability", "department": "Data Science", "semester": "Semester 1",
     "description": "Probability theory, random variables, sampling distributions, hypothesis testing, regression, and Bayesian inference.",
     "syllabus_topics": ["Probability Theory", "Random Variables", "Expected Value and Variance", "Sampling Distributions", "Estimation", "Hypothesis Testing", "Linear Regression", "Bayesian Inference"]},
    {"course_id": "DS201", "name": "Data Preprocessing and Visualization", "department": "Data Science", "semester": "Semester 3",
     "description": "Data wrangling, missing value imputation, outlier detection, feature scaling, EDA, and interactive visualizations.",
     "syllabus_topics": ["Data Wrangling", "Missing Value Imputation", "Feature Scaling and Encoding", "Exploratory Data Analysis", "Visualization Principles", "Interactive Visualizations Plotly", "High-Dimensional Projections", "Dashboard Creation"]},
    {"course_id": "DS301", "name": "Machine Learning Fundamentals", "department": "Data Science", "semester": "Semester 5",
     "description": "Supervised and unsupervised machine learning algorithms using Python. Linear regression, logistic regression, decision trees, random forests, SVMs, k-means clustering, cross-validation, ROC-AUC, regularization.",
     "syllabus_topics": ["Supervised Learning Workflows and Pipelines", "Linear and Logistic Regression", "Decision Trees and Random Forest Ensembles", "Support Vector Machines", "K-Means Clustering", "Model Evaluation: Precision, Recall, ROC-AUC", "Cross-Validation and Hyperparameter Tuning", "Regularization L1/L2", "Dimensionality Reduction PCA", "Feature Selection"]},
    {"course_id": "AI101", "name": "Introduction to Artificial Intelligence", "department": "Artificial Intelligence", "semester": "Semester 1",
     "description": "Overview of AI: search algorithms, game theory, constraint satisfaction, knowledge representation, logic, and probabilistic reasoning.",
     "syllabus_topics": ["History of AI", "Intelligent Agents", "Search Algorithms A* Greedy", "Adversarial Search Minimax", "Constraint Satisfaction", "Propositional Logic", "Knowledge Representation", "Bayesian Networks"]},
    {"course_id": "AI201", "name": "Neural Networks and Deep Learning", "department": "Artificial Intelligence", "semester": "Semester 3",
     "description": "Neural networks, backpropagation, gradient descent (Adam, RMSProp), CNNs for image classification, RNNs/LSTMs, dropout, batch normalization, deep learning frameworks.",
     "syllabus_topics": ["Perceptrons and Multilayer Networks", "Backpropagation and Gradient Computation", "Loss and Activation Functions", "Gradient Descent: Adam, RMSProp, SGD", "CNNs for Image Classification", "RNNs and LSTMs", "Regularization: Dropout, Batch Norm, Weight Decay", "Deep Learning Frameworks", "Transfer Learning"]},
    {"course_id": "AI301", "name": "Natural Language Processing", "department": "Artificial Intelligence", "semester": "Semester 5",
     "description": "Tokenization, stemming, TF-IDF, word embeddings, sequence models, attention mechanisms, Transformers, BERT, GPT.",
     "syllabus_topics": ["Tokenization and Stemming", "TF-IDF Weighting", "Word2Vec and GloVe", "Named Entity Recognition", "Sentiment Classification", "Seq2Seq with Attention", "Transformer Architectures", "Pretrained Models BERT GPT"]},
    {"course_id": "AI401", "name": "Computer Vision", "department": "Artificial Intelligence", "semester": "Semester 7",
     "description": "Image processing, edge detection, feature extraction, deep CNNs, object detection (YOLO, Faster R-CNN), segmentation, optical flow.",
     "syllabus_topics": ["Image Processing", "Edge Detection Sobel Canny", "Feature Matching SIFT ORB", "Deep CNNs for Classification", "Object Detection YOLO", "Semantic Segmentation", "Optical Flow", "Generative Image Models"]},
    {"course_id": "AI501", "name": "Explainable AI and AI Ethics", "department": "Artificial Intelligence", "semester": "Semester 7",
     "description": "Algorithmic bias, fairness, interpretability (SHAP, LIME), data privacy, AI safety, governance, and ethical auditing.",
     "syllabus_topics": ["Trustworthy AI", "Algorithmic Bias and Fairness", "Interpretability vs Explainability", "LIME and Saliency Maps", "SHAP Shapley Values", "Data Privacy", "AI Safety and Robustness", "AI Governance and Ethics"]},
    {"course_id": "ML101", "name": "Applied Machine Learning", "department": "Machine Learning", "semester": "Semester 3",
     "description": "Hands-on supervised and unsupervised machine learning. Linear regression, logistic regression, decision trees, random forests, SVMs, cross-validation, ROC-AUC, precision, recall, regularization, k-means, PCA.",
     "syllabus_topics": ["Supervised Learning Workflows and Pipelines", "Linear and Logistic Regression", "Decision Trees and Random Forest Ensembles", "Support Vector Machines", "Model Evaluation: Precision, Recall, ROC-AUC", "Cross-Validation and Hyperparameter Tuning", "Regularization and Overfitting Prevention", "K-Means Clustering", "Dimensionality Reduction PCA", "Feature Selection"]},
    {"course_id": "ML201", "name": "Advanced Deep Learning", "department": "Machine Learning", "semester": "Semester 5",
     "description": "Advanced deep neural networks, backpropagation, gradient descent (Adam, RMSProp), CNNs with residual connections, RNNs with attention, GANs, dropout, batch normalization, transfer learning.",
     "syllabus_topics": ["Multilayer Neural Architectures", "Backpropagation and Gradient Computation", "Gradient Descent: Adam, RMSProp, SGD", "CNNs and Deep Residual Networks", "Regularization: Dropout, Batch Norm, Weight Decay", "RNNs and Attention Mechanisms", "GANs", "Transfer Learning", "Distributed Deep Learning"]},
    {"course_id": "CS401", "name": "Software Engineering", "department": "Computer Science", "semester": "Semester 7",
     "description": "Agile/Scrum, requirements engineering, microservices, OOP design patterns, testing, CI/CD, version control.",
     "syllabus_topics": ["Agile and Scrum", "Requirements Engineering", "Microservices Architecture", "SOLID Principles", "Testing Strategies", "CI/CD Pipelines", "Version Control", "Refactoring and Tech Debt"]},
]

DEFAULT_CURRICULUM = {
    "name": "Standard AI & Data Science Curriculum",
    "department": "Computer Science & AI",
    "topics": [
        "Python Programming", "Statistics and Probability", "Data Preprocessing",
        "Data Visualization", "Machine Learning Fundamentals", "Supervised Learning",
        "Unsupervised Learning", "Neural Networks", "Deep Learning",
        "Natural Language Processing", "Computer Vision", "Explainable AI",
        "AI Ethics", "Database Systems", "Software Engineering",
        "Reinforcement Learning", "Big Data Analytics", "Cloud Computing",
    ],
}


def load_sample_data():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM courses")
    if c.fetchone()[0] == 0:
        now = datetime.utcnow().isoformat()
        for course in SAMPLE_COURSES:
            c.execute(
                "INSERT OR IGNORE INTO courses (course_id, name, department, semester, description, syllabus_topics, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                (course["course_id"], course["name"], course["department"], course["semester"],
                 course["description"], json.dumps(course["syllabus_topics"]), now, now))
    c.execute("SELECT COUNT(*) FROM reference_curricula")
    if c.fetchone()[0] == 0:
        now = datetime.utcnow().isoformat()
        c.execute("INSERT INTO reference_curricula (name, department, topics, created_at) VALUES (?,?,?,?)",
                  (DEFAULT_CURRICULUM["name"], DEFAULT_CURRICULUM["department"], json.dumps(DEFAULT_CURRICULUM["topics"]), now))
    conn.commit()
    conn.close()


load_sample_data()


# ──────────────────────────────────────────────────────────
# NLP Engine
# ──────────────────────────────────────────────────────────
def preprocess_text(text: str) -> str:
    if not text:
        return ""
    cleaned = text.lower()
    cleaned = re.sub(r"[^a-zA-Z0-9\s\-]", " ", cleaned)
    cleaned = cleaned.replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def prepare_course_text(course: dict) -> str:
    parts = []
    name = course.get("name", "")
    if name:
        parts.extend([name, name])
    desc = course.get("description", "")
    if desc:
        parts.append(desc)
    topics = course.get("syllabus_topics", [])
    if isinstance(topics, str):
        try:
            topics = json.loads(topics)
        except Exception:
            topics = [topics]
    topic_text = " ".join(str(t) for t in topics)
    if topic_text:
        parts.extend([topic_text, topic_text, topic_text])
    return " ".join(parts)


def compute_similarity(courses: list, threshold: float = DEFAULT_THRESHOLD):
    if len(courses) < 2:
        return None, [], [], []

    texts = [prepare_course_text(c) for c in courses]
    preprocessed = [preprocess_text(t) for t in texts]

    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True,
                                 token_pattern=r"(?u)\b[a-zA-Z0-9_]{2,}\b")
    tfidf_matrix = vectorizer.fit_transform(preprocessed)
    sim_matrix = cosine_similarity(tfidf_matrix)
    np.fill_diagonal(sim_matrix, 1.0)
    sim_matrix = np.clip(sim_matrix, 0.0, 1.0)

    n = len(courses)
    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            score = float(sim_matrix[i][j])
            common = get_common_terms(texts[i], texts[j])
            pairs.append({
                "course1": courses[i].get("course_id", ""),
                "course1_name": courses[i].get("name", ""),
                "course2": courses[j].get("course_id", ""),
                "course2_name": courses[j].get("name", ""),
                "similarity": round(score, 4),
                "common_terms": common,
            })
    pairs.sort(key=lambda x: x["similarity"], reverse=True)
    high = [p for p in pairs if p["similarity"] >= threshold]

    labels = [f"{c.get('course_id', '')}: {c.get('name', '')}" for c in courses]
    return sim_matrix, pairs, high, labels


def get_common_terms(text1: str, text2: str, top_n=8):
    clean1 = preprocess_text(text1)
    clean2 = preprocess_text(text2)
    if not clean1 or not clean2:
        return []
    try:
        vec = TfidfVectorizer(stop_words="english", token_pattern=r"(?u)\b[a-zA-Z]{3,}\b", ngram_range=(1, 2))
        matrix = vec.fit_transform([clean1, clean2])
        features = vec.get_feature_names_out()
        r1 = matrix.getrow(0).toarray()[0]
        r2 = matrix.getrow(1).toarray()[0]
        common = {}
        for idx, feat in enumerate(features):
            if r1[idx] > 0 and r2[idx] > 0:
                common[feat] = (2 * r1[idx] * r2[idx]) / (r1[idx] + r2[idx])
        return [t for t, _ in sorted(common.items(), key=lambda x: x[1], reverse=True)[:top_n]]
    except Exception:
        return []


def analyze_gaps(courses: list, ref_topics: list):
    if not ref_topics or not courses:
        return []

    course_texts = [prepare_course_text(c) for c in courses]
    cleaned_courses = [preprocess_text(t) for t in course_texts]
    cleaned_topics = [preprocess_text(t) for t in ref_topics]

    all_docs = cleaned_courses + cleaned_topics
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True,
                                 token_pattern=r"(?u)\b[a-zA-Z0-9_]{2,}\b")
    try:
        tfidf_all = vectorizer.fit_transform(all_docs)
        courses_vec = tfidf_all[:len(courses)]
        topics_vec = tfidf_all[len(courses):]
        matrix = cosine_similarity(topics_vec, courses_vec)
    except ValueError:
        matrix = np.zeros((len(ref_topics), len(courses)))

    matrix = np.clip(matrix, 0.0, 1.0)
    results = []
    for t_idx, topic in enumerate(ref_topics):
        scores = matrix[t_idx]
        max_score = float(np.max(scores)) if len(scores) > 0 else 0.0

        matches = []
        for c_idx, sc in enumerate(scores):
            rel = float(sc)
            if topic.lower() in course_texts[c_idx].lower():
                rel = max(rel, 0.5)
                max_score = max(max_score, rel)
            if rel >= 0.15:
                matches.append({"course_id": courses[c_idx].get("course_id", ""),
                                "course_name": courses[c_idx].get("name", ""),
                                "relevance": round(rel, 3)})
        matches.sort(key=lambda m: m["relevance"], reverse=True)

        if max_score >= 0.30:
            status = "✅ Covered"
        elif max_score >= 0.15:
            status = "⚠️ Partial"
        else:
            status = "❌ Missing"
        results.append({"topic": topic, "status": status, "score": round(max_score, 3), "matches": matches})
    return results


# ──────────────────────────────────────────────────────────
# Helpers: load data from DB, build heatmap
# ──────────────────────────────────────────────────────────
def get_courses_from_db():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM courses ORDER BY course_id").fetchall()
    conn.close()
    courses = []
    for r in rows:
        c = dict(r)
        try:
            c["syllabus_topics"] = json.loads(c["syllabus_topics"])
        except Exception:
            c["syllabus_topics"] = []
        courses.append(c)
    return courses


def get_curricula_from_db():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM reference_curricula ORDER BY id").fetchall()
    conn.close()
    curricula = []
    for r in rows:
        c = dict(r)
        try:
            c["topics"] = json.loads(c["topics"])
        except Exception:
            c["topics"] = []
        curricula.append(c)
    return curricula


def build_heatmap(sim_matrix, labels, title, height=520, show_colorbar=True):
    short_labels = [l.split(":")[0].strip() for l in labels]
    fig = go.Figure(data=go.Heatmap(
        z=sim_matrix, x=short_labels, y=short_labels,
        colorscale=[[0, "#ecfdf5"], [0.15, "#a7f3d0"], [0.3, "#fbbf24"],
                    [0.5, "#f97316"], [0.7, "#dc2626"], [1.0, "#4338ca"]],
        text=np.round(sim_matrix * 100, 1).astype(str),
        texttemplate="%{text}%", textfont={"size": 9},
        zmin=0, zmax=1,
        showscale=show_colorbar,
        colorbar=dict(title="Similarity") if show_colorbar else None,
    ))
    fig.update_layout(
        title=title, height=height, xaxis_tickangle=-45,
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        yaxis=dict(autorange="reversed"),
    )
    return fig


# ──────────────────────────────────────────────────────────
# Styling (dark-theme safe: no forced light backgrounds)
# ──────────────────────────────────────────────────────────
st.markdown("""
<style>
    .stApp, [data-testid="stAppViewContainer"], [data-testid="stMain"] {
        background-color: #0E1117 !important;
    }
    h1, h2, h3, h4, h5, h6, p, li, label, span, div[data-testid="stMarkdownContainer"] {
        color: #E6EAF2;
    }
    [data-testid="stMetric"] {
        background: #161B26; padding: 1rem; border-radius: 12px;
        border: 1px solid #2A3142;
    }
    .high-sim {
        background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.45);
        color: #FECACA; padding: 0.8rem; border-radius: 8px; margin-bottom: 0.5rem;
    }
    .high-sim strong { color: #FFFFFF; }
    .disclaimer {
        background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.45);
        color: #BFDBFE; padding: 0.7rem; border-radius: 8px;
        font-size: 0.85rem; margin-top: 1rem;
    }
    [data-testid="stSidebar"] {
        background-color: #111622 !important;
        border-right: 1px solid #2A3142;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] label {
        padding: 10px 14px;
        border-radius: 10px;
        margin-bottom: 4px;
        font-size: 1.05rem;
        width: 100%;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] label:hover {
        background: rgba(255, 255, 255, 0.06);
    }
    [data-testid="stSidebar"] div[role="radiogroup"] label:has(input:checked) {
        background: rgba(108, 99, 255, 0.25);
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

# ──────────────────────────────────────────────────────────
# Sidebar
# ──────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🎓 Gap Analyzer")
    st.markdown("---")
    page = st.radio(
        "Navigation",
        ["📊 Dashboard", "📚 Courses", "🔬 Similarity Analysis", "🎯 Gap Analysis",
         "💡 Recommendations", "⚙️ Settings"],
        label_visibility="collapsed",
    )
    st.markdown("---")
    st.caption("Course Description Similarity & Curriculum Gap Analyzer v1.0")

courses_list = get_courses_from_db()
curricula_list = get_curricula_from_db()

# ─── Dashboard ───
if page == "📊 Dashboard":
    st.title("📊 Curriculum Intelligence Dashboard")
    st.caption("Overview of course similarities, curriculum coverage, and recommendations.")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Courses", len(courses_list))
    col2.metric("Departments", len(set(c["department"] for c in courses_list)))
    col3.metric("Curricula", len(curricula_list))
    ref_topics_count = sum(len(c.get("topics", [])) for c in curricula_list)
    col4.metric("Reference Topics", ref_topics_count)

    if len(courses_list) >= 2:
        st.markdown("### Quick Similarity Preview")
        sim_matrix, pairs, high, labels = compute_similarity(courses_list, DEFAULT_THRESHOLD)
        st.info(f"**{len(high)}** high-overlap course pairs detected (≥{int(DEFAULT_THRESHOLD * 100)}% similarity)")

        st.plotly_chart(build_heatmap(sim_matrix, labels, "Course Similarity Heatmap"),
                        use_container_width=True)

        if high:
            st.markdown("### ⚠️ High-Overlap Alerts")
            for p in high[:5]:
                common = (" • Common: " + ", ".join(p["common_terms"][:4])) if p["common_terms"] else ""
                st.markdown(f"""<div class="high-sim">
                <strong>{p['course1']} ({p['course1_name']})</strong> ↔ <strong>{p['course2']} ({p['course2_name']})</strong>
                — <strong>{p['similarity'] * 100:.1f}%</strong> similarity{common}
                </div>""", unsafe_allow_html=True)
    else:
        st.info("Add at least 2 courses to see similarity analysis.")

# ─── Courses ───
elif page == "📚 Courses":
    st.title("📚 Course Management")

    tab1, tab2, tab3 = st.tabs(["View Courses", "Add Course", "Import CSV"])

    with tab1:
        if courses_list:
            search = st.text_input("🔍 Search courses", "")
            s = search.lower()
            filtered = [c for c in courses_list
                        if s in c["name"].lower() or s in c["course_id"].lower() or s in c["department"].lower()] if search else courses_list
            for c in filtered:
                topics = c["syllabus_topics"] if isinstance(c["syllabus_topics"], list) else []
                with st.expander(f"**{c['course_id']}** — {c['name']} ({c['department']}, {c['semester']})"):
                    st.write(c["description"])
                    if topics:
                        st.markdown("**Topics:** " + " • ".join(topics))
                    if st.button(f"Delete {c['course_id']}", key=f"del_{c['course_id']}"):
                        conn = get_conn()
                        conn.execute("DELETE FROM courses WHERE course_id = ?", (c["course_id"],))
                        conn.commit()
                        conn.close()
                        st.rerun()
        else:
            st.info("No courses yet. Add courses or load sample data from Settings.")

    with tab2:
        with st.form("add_course"):
            cid = st.text_input("Course ID*", placeholder="e.g. CS501")
            cname = st.text_input("Course Name*", placeholder="e.g. Cloud Computing")
            dept = st.text_input("Department", placeholder="e.g. Computer Science")
            sem = st.text_input("Semester", placeholder="e.g. Semester 6")
            desc = st.text_area("Description*", placeholder="Course description...")
            topics_str = st.text_area("Syllabus Topics (one per line)", placeholder="Topic 1\nTopic 2\nTopic 3")
            submitted = st.form_submit_button("Add Course")
            if submitted:
                if not cid or not cname or not desc:
                    st.error("Course ID, Name, and Description are required.")
                else:
                    topics = [t.strip() for t in topics_str.strip().split("\n") if t.strip()]
                    conn = get_conn()
                    try:
                        conn.execute(
                            "INSERT INTO courses (course_id, name, department, semester, description, syllabus_topics) VALUES (?,?,?,?,?,?)",
                            (cid, cname, dept, sem, desc, json.dumps(topics)))
                        conn.commit()
                        st.success(f"Course {cid} added!")
                        st.rerun()
                    except sqlite3.IntegrityError:
                        st.error(f"Course {cid} already exists!")
                    finally:
                        conn.close()

    with tab3:
        st.markdown("Upload a CSV file with columns: `course_id, name, department, semester, description, syllabus_topics` (topics separated by `;`)")
        uploaded = st.file_uploader("Upload CSV", type=["csv"])
        if uploaded:
            df = pd.read_csv(uploaded)
            st.dataframe(df.head())
            if st.button("Import Courses"):
                conn = get_conn()
                imported = 0
                for _, row in df.iterrows():
                    try:
                        topics = [t.strip() for t in str(row.get("syllabus_topics", "")).split(";") if t.strip()] \
                            if pd.notna(row.get("syllabus_topics")) else []
                        conn.execute(
                            "INSERT OR REPLACE INTO courses (course_id, name, department, semester, description, syllabus_topics) VALUES (?,?,?,?,?,?)",
                            (str(row["course_id"]), str(row["name"]), str(row.get("department", "")),
                             str(row.get("semester", "")), str(row.get("description", "")), json.dumps(topics)))
                        imported += 1
                    except Exception as e:
                        st.warning(f"Skipped {row.get('course_id')}: {e}")
                conn.commit()
                conn.close()
                st.success(f"Imported {imported} courses!")
                st.rerun()

# ─── Similarity Analysis ───
elif page == "🔬 Similarity Analysis":
    st.title("🔬 Course Similarity Analysis")
    st.caption("Compute pairwise TF-IDF cosine similarity between all course syllabi.")

    if len(courses_list) < 2:
        st.warning("Need at least 2 courses. Go to Courses or Settings to add/load courses.")
    else:
        threshold = st.slider("Overlap Threshold", 0.1, 1.0, DEFAULT_THRESHOLD, 0.05)
        st.caption("TF-IDF measures lexical (word-level) similarity. It does not perfectly understand curriculum content.")

        if st.button("🚀 Run Similarity Analysis", type="primary"):
            with st.spinner("Computing TF-IDF similarity matrix..."):
                result = compute_similarity(courses_list, threshold)
            sim_matrix, pairs, high, labels = result
            st.session_state["sim_result"] = (sim_matrix, pairs, high, labels, threshold)
            st.success(f"Analysis complete! {len(high)} high-overlap pairs found.")

        if "sim_result" in st.session_state:
            sim_matrix, pairs, high, labels, th = st.session_state["sim_result"]

            st.plotly_chart(build_heatmap(sim_matrix, labels, "Similarity Heatmap", height=560, show_colorbar=False),
                            use_container_width=True)

            st.markdown("### Ranked Course Pairs")
            for i, p in enumerate(pairs[:20]):
                sim_pct = p["similarity"] * 100
                icon = "🔴" if sim_pct >= th * 100 else "🟡" if sim_pct >= 30 else "🟢"
                terms = ", ".join(p["common_terms"][:5]) if p["common_terms"] else ""
                extra = f"| _{terms}_" if terms else ""
                st.markdown(f"{icon} **#{i + 1}** {p['course1']} ({p['course1_name']}) ↔ {p['course2']} ({p['course2_name']}) — **{sim_pct:.1f}%** {extra}")

            csv_data = "Course 1,Course 1 Name,Course 2,Course 2 Name,Similarity,Common Terms\n"
            for p in pairs:
                csv_data += f"{p['course1']},\"{p['course1_name']}\",{p['course2']},\"{p['course2_name']}\",{p['similarity']},\"{';'.join(p['common_terms'])}\"\n"
            st.download_button("📥 Download CSV", csv_data, "similarity_results.csv", "text/csv")

# ─── Gap Analysis ───
elif page == "🎯 Gap Analysis":
    st.title("🎯 Curriculum Gap Analysis")
    st.caption("Compare course content against a reference curriculum to find missing topics.")

    if not curricula_list:
        st.warning("No reference curriculum found. Go to Settings to load sample data.")
    elif not courses_list:
        st.warning("No courses found. Add courses first.")
    else:
        selected_curriculum = st.selectbox(
            "Select Reference Curriculum",
            options=curricula_list,
            format_func=lambda c: f"{c['name']} ({len(c['topics'])} topics)")
        if st.button("🎯 Run Gap Analysis", type="primary"):
            with st.spinner("Analyzing curriculum coverage..."):
                results = analyze_gaps(courses_list, selected_curriculum["topics"])
                st.session_state["gap_result"] = results

        if "gap_result" in st.session_state:
            results = st.session_state["gap_result"]
            covered = sum(1 for r in results if "Covered" in r["status"])
            partial = sum(1 for r in results if "Partial" in r["status"])
            missing = sum(1 for r in results if "Missing" in r["status"])
            total = len(results)

            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Total Topics", total)
            col2.metric("✅ Covered", covered)
            col3.metric("⚠️ Partial", partial)
            col4.metric("❌ Missing", missing)

            pct = round((covered / total) * 100, 1) if total > 0 else 0
            st.progress(pct / 100, text=f"Coverage: {pct}%")

            st.markdown("### Topic Coverage Details")
            for r in results:
                with st.expander(f"{r['status']} **{r['topic']}** (score: {r['score']})"):
                    if r["matches"]:
                        for m in r["matches"]:
                            st.write(f"- {m['course_id']} ({m['course_name']}) — relevance: {m['relevance']}")
                    else:
                        st.write("No matching courses found.")

            st.markdown('<div class="disclaimer">⚠️ Gap detection depends on the reference curriculum you selected. Topics flagged as missing may be covered under different names or in elective courses not in the database.</div>', unsafe_allow_html=True)

# ─── Recommendations ───
elif page == "💡 Recommendations":
    st.title("💡 Smart Recommendations")
    st.caption("Suggestions based on similarity and gap analysis results.")

    has_sim = "sim_result" in st.session_state
    has_gap = "gap_result" in st.session_state

    if not has_sim and not has_gap:
        st.info("Run a Similarity Analysis or Gap Analysis first to generate recommendations.")
    else:
        recs = []
        if has_sim:
            _, pairs, high, _, th = st.session_state["sim_result"]
            for p in high:
                terms = ", ".join(p["common_terms"][:4]) if p["common_terms"] else "shared topics"
                priority = "🔴 High" if p["similarity"] >= 0.7 else "🟡 Medium"
                recs.append({
                    "type": "High Overlap",
                    "priority": priority,
                    "desc": f"**{p['course1']}** and **{p['course2']}** share {p['similarity'] * 100:.1f}% content overlap ({terms})",
                    "action": f"Review syllabi of {p['course1']} and {p['course2']} to establish clearer boundaries. Consider merging overlapping modules.",
                })
            seq_count = 0
            for p in pairs:
                if 0.30 <= p["similarity"] < th:
                    terms = ", ".join(p["common_terms"][:3]) if p["common_terms"] else "core topics"
                    recs.append({
                        "type": "Course Sequencing",
                        "priority": "🔵 Low",
                        "desc": f"Moderate alignment ({p['similarity'] * 100:.1f}%) between **{p['course1']}** and **{p['course2']}** on {terms}",
                        "action": f"Verify prerequisite ordering between {p['course1']} and {p['course2']}.",
                    })
                    seq_count += 1
                    if seq_count >= 2:
                        break

        if has_gap:
            for r in st.session_state["gap_result"]:
                if "Missing" in r["status"]:
                    recs.append({
                        "type": "Missing Topic",
                        "priority": "🔴 High",
                        "desc": f"Reference topic **'{r['topic']}'** has negligible coverage (score: {r['score']})",
                        "action": f"Design a dedicated unit on '{r['topic']}' in an existing course or introduce a new elective.",
                    })
                elif "Partial" in r["status"]:
                    courses_str = ", ".join(m["course_id"] for m in r["matches"][:3])
                    recs.append({
                        "type": "Partial Coverage",
                        "priority": "🟡 Medium",
                        "desc": f"Topic **'{r['topic']}'** only partially covered (score: {r['score']}) in {courses_str}",
                        "action": f"Expand learning objectives for '{r['topic']}' with deeper practical work.",
                    })

        if recs:
            for rec in recs:
                st.markdown(f"""
**{rec['priority']} — {rec['type']}**

{rec['desc']}

> 💡 **Suggested Action:** {rec['action']}

---
""")
        else:
            st.success("No issues detected! All courses have clear boundaries and good coverage.")

        st.markdown('<div class="disclaimer">⚠️ These are suggestions based on text similarity analysis. They require academic review and should not be treated as final curriculum decisions.</div>', unsafe_allow_html=True)

# ─── Settings ───
elif page == "⚙️ Settings":
    st.title("⚙️ Settings & Project Info")

    st.markdown("### Sample Data Management")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("📥 Load Sample Data (14 Courses)"):
            conn = get_conn()
            conn.execute("DELETE FROM courses")
            conn.execute("DELETE FROM reference_curricula")
            conn.commit()
            conn.close()
            load_sample_data()
            st.success("Sample data loaded!")
            st.rerun()
    with col2:
        if st.button("🗑️ Clear All Data"):
            conn = get_conn()
            conn.execute("DELETE FROM courses")
            conn.execute("DELETE FROM reference_curricula")
            conn.commit()
            conn.close()
            st.success("All data cleared.")
            st.rerun()

    st.markdown("### Reference Curriculum")
    st.markdown("**Current curricula:**")
    for cur in curricula_list:
        with st.expander(f"{cur['name']} ({len(cur['topics'])} topics)"):
            for t in cur["topics"]:
                st.write(f"- {t}")

    st.markdown("### Add Custom Curriculum")
    with st.form("add_curriculum"):
        cur_name = st.text_input("Curriculum Name")
        cur_dept = st.text_input("Department")
        cur_topics = st.text_area("Topics (one per line)")
        if st.form_submit_button("Add Curriculum"):
            topics = [t.strip() for t in cur_topics.split("\n") if t.strip()]
            if cur_name and topics:
                conn = get_conn()
                conn.execute("INSERT INTO reference_curricula (name, department, topics) VALUES (?,?,?)",
                             (cur_name, cur_dept, json.dumps(topics)))
                conn.commit()
                conn.close()
                st.success(f"Curriculum '{cur_name}' added with {len(topics)} topics!")
                st.rerun()

    st.markdown("---")
    st.markdown("### About")
    st.markdown("""
**Course Description Similarity & Curriculum Gap Analyzer**

An NLP-powered web application that analyzes academic course descriptions to identify
similarity, detect curriculum gaps, and generate evidence-based recommendations.

**Technology Stack:** Python, Streamlit, scikit-learn (TF-IDF), NumPy, Pandas, Plotly, SQLite

**Note:** TF-IDF measures lexical similarity. For semantic similarity, the full-stack version
supports sentence-transformers. All results are suggestions requiring academic review.
""")
