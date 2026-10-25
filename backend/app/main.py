"""Main FastAPI application for Course Description Similarity & Curriculum Gap Analyzer."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
