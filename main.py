from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.rag_service import RAGService


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the models and database connection only once
    rag_service = RAGService()
    app.state.rag_service = rag_service

    try:
        yield
    finally:
        rag_service.close()


app = FastAPI(
    title="CIS Controls Local RAG",
    lifespan=lifespan,
)


# Allow the React frontend to call the backend
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


@app.get("/health")
def health(request: Request) -> dict[str, Any]:
    rag_service: RAGService = request.app.state.rag_service

    return {
        "status": "ok",
        "startup_timings": rag_service.startup_timings,
    }


@app.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request_body: ChatRequest,
    request: Request,
) -> dict[str, Any]:
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