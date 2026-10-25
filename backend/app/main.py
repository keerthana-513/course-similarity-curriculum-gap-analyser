"""Main FastAPI application for Course Description Similarity & Curriculum Gap Analyzer."""
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db, get_db_connection
from app.sample_data import load_sample_data
from app.routers import courses, analysis, curricula

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("curriculum_analyzer")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    logger.info("Initializing database...")
    init_db()
    logger.info("Loading initial sample data if database is empty...")
    try:
        sample_res = load_sample_data(force=False)
        logger.info(f"Sample data status: {sample_res}")
    except Exception as e:
        logger.error(f"Error loading sample data: {e}")

    yield

    logger.info("Application shutting down.")


# Create FastAPI application instance
app = FastAPI(
    title="Course Description Similarity & Curriculum Gap Analyzer API",
    description=(
        "Production-quality backend API providing NLP text similarity, "
        "curriculum gap identification, and academic advisory recommendations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS Middleware
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers under /api prefix
app.include_router(courses.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(curricula.router, prefix="/api")


@app.get("/", tags=["Info"])
def root_info():
    """Root endpoint returning API information."""
    return {
        "name": "Course Description Similarity & Curriculum Gap Analyzer API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "endpoints": {
            "health": "/api/health",
            "courses": "/api/courses",
            "curricula": "/api/curricula",
            "similarity_analysis": "/api/analysis/similarity",
            "gap_analysis": "/api/analysis/gap",
            "analysis_status": "/api/analysis/status",
        },
    }


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint verifying system and database connectivity."""
    db_status = "connected"
    try:
        conn = get_db_connection()
        conn.execute("SELECT 1;")
        conn.close()
    except Exception as e:
        db_status = f"error: {str(e)}"
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": db_status},
        )

    return {
        "status": "healthy",
        "database": db_status,
    }


# Serve React frontend build (for production / deployment)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Serve static assets (JS/CSS/images)
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="static-assets")

    @app.get("/{full_path:path}", tags=["Frontend"])
    async def serve_frontend(request: Request, full_path: str):
        """Serve React SPA — all non-API routes fall through to index.html."""
        # Don't interfere with /api or /docs
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})

        # Try serving the exact file first
        file_path = STATIC_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))

        # Fallback to index.html for SPA routing
        return FileResponse(str(STATIC_DIR / "index.html"))
