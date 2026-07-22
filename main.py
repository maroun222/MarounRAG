from contextlib import asynccontextmanager
from typing import Any, Iterator

import json
from src.auth.routes import router as auth_router
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.database.mongodb import mongodb
from src.rag_service import RAGService


# ============================================================
# Request and response models
# ============================================================

class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
    )


class ChatResponse(BaseModel):
    answer: str
    page: int | None
    context: str
    retrieval_context: list[str]
    cache_hit: bool
    timings: dict[str, float]


# ============================================================
# Application startup and shutdown
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize reusable application services once during startup.

    Startup:
    1. Connect to MongoDB.
    2. Load the RAG models and connect to Weaviate.

    Shutdown:
    1. Close the RAG service.
    2. Close MongoDB.
    """

    rag_service: RAGService | None = None

    try:
        # Connect once and verify MongoDB is available.
        mongodb.connect()
        app.state.mongodb = mongodb

        # Load models and connect to Weaviate once.
        rag_service = RAGService()
        app.state.rag_service = rag_service

        yield

    finally:
        if rag_service is not None:
            rag_service.close()

        mongodb.close()


# ============================================================
# FastAPI application
# ============================================================

app = FastAPI(
    title="CIS Controls Local RAG",
    description=(
        "Local RAG backend with standard and SSE-streaming "
        "chat endpoints."
    ),
    version="1.1.0",
    lifespan=lifespan,
)


# Allow the React frontend to call the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add authentication routes:
# POST /auth/register
# POST /auth/login
app.include_router(auth_router)


# ============================================================
# SSE helper
# ============================================================

def format_sse(
    event: str,
    data: dict[str, Any],
) -> str:
    """
    Convert one event into Server-Sent Events format.

    Every SSE message must end with two newline characters.
    """

    payload = json.dumps(
        data,
        ensure_ascii=False,
    )

    return (
        f"event: {event}\n"
        f"data: {payload}\n\n"
    )


# ============================================================
# Health endpoint
# ============================================================

@app.get("/health")
def health(
    request: Request,
) -> dict[str, Any]:
    """
    Verify that the RAG service and MongoDB are available.
    """

    rag_service: RAGService = request.app.state.rag_service
    mongo_service = request.app.state.mongodb

    try:
        mongo_service.client.admin.command("ping")
        mongodb_status = "connected"

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unavailable",
                "service": "CIS Controls Local RAG",
                "mongodb": "disconnected",
                "error": str(error),
            },
        ) from error

    return {
        "status": "ok",
        "service": "CIS Controls Local RAG",
        "components": {
            "rag": "ready",
            "mongodb": mongodb_status,
        },
        "database": {
            "name": mongo_service.db.name,
        },
        "startup_timings": rag_service.startup_timings,
    }


# ============================================================
# Normal non-streaming chat endpoint
# ============================================================

@app.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request_body: ChatRequest,
    request: Request,
) -> dict[str, Any]:
    """
    Return the complete RAG answer as one JSON response.
    """

    rag_service: RAGService = request.app.state.rag_service

    try:
        return rag_service.answer_question(
            request_body.message
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "An unexpected error occurred: "
                f"{error}"
            ),
        ) from error


# ============================================================
# SSE streaming chat endpoint
# ============================================================

@app.post("/chat/stream")
def chat_stream(
    request_body: ChatRequest,
    request: Request,
) -> StreamingResponse:
    """
    Stream RAG progress and generated answer tokens.

    Event types:
    - status
    - metadata
    - token
    - done
    - error
    """

    rag_service: RAGService = request.app.state.rag_service

    def event_generator() -> Iterator[str]:
        try:
            for item in rag_service.stream_answer_question(
                request_body.message
            ):
                yield format_sse(
                    item["event"],
                    item["data"],
                )

        except ValueError as error:
            yield format_sse(
                "error",
                {
                    "message": str(error),
                },
            )

        except RuntimeError as error:
            yield format_sse(
                "error",
                {
                    "message": str(error),
                },
            )

        except Exception as error:
            yield format_sse(
                "error",
                {
                    "message": (
                        "An unexpected error occurred: "
                        f"{error}"
                    ),
                },
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            # Prevent browsers and proxies from caching the stream.
            "Cache-Control": "no-cache",

            # Keep the HTTP connection open while tokens arrive.
            "Connection": "keep-alive",

            # Prevent proxy buffering.
            "X-Accel-Buffering": "no",
        },
    )