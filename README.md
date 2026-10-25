# Course Description Similarity & Curriculum Gap Analyzer

An NLP-powered web application that analyzes academic course descriptions and syllabi to identify semantic similarity, detect curriculum gaps, and generate evidence-based recommendations.

## 🎯 Features

- **Course Management**: Add, edit, delete, and import courses with descriptions and syllabus topics
- **NLP Similarity Analysis**: Compute pairwise similarity using TF-IDF or Sentence Transformers
- **Curriculum Gap Detection**: Compare courses against a reference curriculum to find missing topics
- **Smart Recommendations**: AI-generated suggestions for merging overlapping content and filling gaps
- **Interactive Dashboard**: Heatmaps, charts, and visual analytics
- **Analysis History**: Track and export past analyses
- **File Upload**: Import courses from CSV, PDF, or TXT files

## 🏗️ Architecture

```
┌─────────────────────┐     REST API      ┌──────────────────────┐
│   React Frontend    │◄──────────────────►│   FastAPI Backend    │
│   (TypeScript/Vite) │                    │   (Python 3.10+)     │
│   Tailwind CSS      │                    │                      │
│   Recharts          │                    │   ┌──────────────┐   │
│   Port: 5173        │                    │   │  NLP Engine   │   │
└─────────────────────┘                    │   │  - TF-IDF     │   │
                                           │   │  - Sentence   │   │
                                           │   │  Transformers │   │
                                           │   └──────────────┘   │
                                           │   ┌──────────────┐   │
                                           │   │   SQLite DB   │   │
                                           │   └──────────────┘   │
                                           │   Port: 8000         │
                                           └──────────────────────┘
```

## 🔬 NLP Pipeline

1. **Text Preprocessing**: Normalize, lowercase, remove stopwords
2. **TF-IDF Vectorization**: Convert course text to TF-IDF vectors
3. **Cosine Similarity**: Compute pairwise similarity matrix
4. **Semantic Similarity** (optional): Use sentence-transformers for deeper semantic matching
5. **Gap Analysis**: Compare course content against reference curriculum topics
6. **Recommendations**: Generate evidence-based suggestions from analysis results

> **Note**: TF-IDF measures lexical (word-level) similarity, while sentence embeddings capture semantic (meaning-level) similarity. Neither method perfectly understands curriculum content — results should be reviewed by academic experts.

## 🚀 Quick Start

### Prerequisites
- Python 3.10+ 
- Node.js 18+
- npm 9+

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs
- **API Docs (ReDoc)**: http://localhost:8000/redoc

## 📁 Project Structure

```
gap-analyser/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── database.py          # SQLite database setup
│   │   ├── sample_data.py       # Demo dataset (14 courses)
│   │   ├── nlp_engine.py        # TF-IDF & semantic similarity
│   │   ├── gap_analyzer.py      # Curriculum gap detection
│   │   ├── recommendation_engine.py  # Smart recommendations
│   │   └── routers/
│   │       ├── courses.py       # Course CRUD endpoints
│   │       ├── analysis.py      # Analysis & export endpoints
│   │       └── curricula.py     # Reference curriculum endpoints
│   ├── tests/
│   │   └── test_nlp.py          # NLP pipeline tests
│   ├── data/                    # SQLite database (auto-created)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app with routing
│   │   ├── services/api.ts      # API client
│   │   ├── pages/               # All page components
│   │   └── components/          # Reusable UI components
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 📊 Sample Dataset

The application includes 14 pre-loaded courses across CS, DS, AI, and ML departments. This demonstration data is designed with intentional overlaps and gaps for testing. You can:
- Delete sample data and upload your own courses
- Import courses from CSV files
- Upload PDF or TXT syllabi

## ⚠️ Limitations

- Similarity analysis is based on text matching, not deep curriculum understanding
- All recommendations are AI-generated suggestions requiring academic expert review
- Semantic model (sentence-transformers) requires downloading a model (~80MB)
- Large course sets (100+) may take longer to analyze

## 📝 License

This project is for academic demonstration purposes.
