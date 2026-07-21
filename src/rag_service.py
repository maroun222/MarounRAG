from __future__ import annotations

# Must be set before importing Hugging Face / Sentence Transformers.
import os

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import re
import threading
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache
from time import perf_counter
from typing import Any, Iterator

import torch
import weaviate
from langchain_huggingface import HuggingFaceEmbeddings
from ollama import Client as OllamaClient
from sentence_transformers import CrossEncoder


WORD_RE = re.compile(r"[A-Za-z]+")
SPACE_RE = re.compile(r"\s+")

STOP_WORDS = {
    "how",
    "should",
    "the",
    "a",
    "an",
    "for",
    "to",
    "of",
    "is",
    "are",
    "be",
    "with",
    "and",
    "often",
    "frequently",
}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)

    if value is None:
        return default

    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(
            f"{name} must be an integer, got {value!r}"
        ) from exc


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)

    if value is None:
        return default

    try:
        return float(value)
    except ValueError as exc:
        raise ValueError(
            f"{name} must be a number, got {value!r}"
        ) from exc


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


@dataclass(frozen=True)
class RAGConfig:
    collection_name: str = os.getenv(
        "RAG_COLLECTION",
        "CISControls",
    )

    embedding_model: str = os.getenv(
        "RAG_EMBEDDING_MODEL",
        "BAAI/bge-small-en-v1.5",
    )

    reranker_model: str = os.getenv(
        "RAG_RERANKER_MODEL",
        "cross-encoder/ms-marco-MiniLM-L4-v2",
    )

    generation_model: str = os.getenv(
        "RAG_GENERATION_MODEL",
        "qwen2.5:1.5b",
    )

    ollama_host: str = os.getenv(
        "OLLAMA_HOST",
        "http://127.0.0.1:11434",
    )

    ollama_keep_alive: str = os.getenv(
        "RAG_OLLAMA_KEEP_ALIVE",
        "30m",
    )

    retrieval_top_k: int = env_int(
        "RAG_RETRIEVAL_TOP_K",
        10,
    )

    top_chunks_for_passages: int = env_int(
        "RAG_TOP_CHUNKS_FOR_PASSAGES",
        5,
    )

    rerank_batch_size: int = env_int(
        "RAG_RERANK_BATCH_SIZE",
        8,
    )

    reranker_max_length: int = env_int(
        "RAG_RERANKER_MAX_LENGTH",
        384,
    )

    # Keep this True for better passage selection.
    # Set RAG_SECOND_PASS_RERANK=0 for a faster mode.
    second_pass_rerank: bool = env_bool(
        "RAG_SECOND_PASS_RERANK",
        True,
    )

    answer_cache_size: int = env_int(
        "RAG_ANSWER_CACHE_SIZE",
        128,
    )

    embedding_cache_size: int = env_int(
        "RAG_EMBEDDING_CACHE_SIZE",
        256,
    )

    torch_threads: int = env_int(
        "RAG_TORCH_THREADS",
        4,
    )

    ollama_timeout: float = env_float(
        "RAG_OLLAMA_TIMEOUT",
        180.0,
    )

    num_ctx: int = env_int(
        "RAG_NUM_CTX",
        1024,
    )

    num_predict: int = env_int(
        "RAG_NUM_PREDICT",
        120,
    )

    warmup_ollama: bool = env_bool(
        "RAG_WARMUP_OLLAMA",
        False,
    )


class Profiler:
    def __init__(self) -> None:
        self.timings: dict[str, float] = {}

    @contextmanager
    def measure(self, name: str) -> Iterator[None]:
        started = perf_counter()

        try:
            yield
        finally:
            self.timings[name] = round(
                perf_counter() - started,
                6,
            )


class RAGService:
    """Reusable local RAG pipeline for the CLI and FastAPI backend."""

    def __init__(
        self,
        config: RAGConfig | None = None,
    ) -> None:
        self.config = config or RAGConfig()

        self.startup_timings: dict[str, float] = {}

        self._answer_cache: OrderedDict[
            str,
            dict[str, Any],
        ] = OrderedDict()

        self._cache_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._closed = False

        self._configure_cpu()

        self.embedding_model = (
            self._load_embedding_model()
        )

        self.reranker = self._load_reranker()

        (
            self.weaviate_client,
            self.collection,
        ) = self._connect_weaviate()

        self.ollama_client = (
            self._create_ollama_client()
        )

        # Cache vectors for repeated questions.
        self._embed_cached = lru_cache(
            maxsize=self.config.embedding_cache_size
        )(self._embed_uncached)

        if self.config.warmup_ollama:
            self._warmup_ollama()

        self.startup_timings["total_startup"] = round(
            sum(self.startup_timings.values()),
            6,
        )

    def _configure_cpu(self) -> None:
        torch.set_num_threads(
            max(1, self.config.torch_threads)
        )

        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            pass

    def _load_embedding_model(
        self,
    ) -> HuggingFaceEmbeddings:
        started = perf_counter()

        model = HuggingFaceEmbeddings(
            model_name=self.config.embedding_model,
            model_kwargs={
                "device": "cpu",
                "local_files_only": True,
            },
            # Do not add show_progress_bar here.
            # The wrapper already passes that argument.
            encode_kwargs={
                "normalize_embeddings": True,
            },
        )

        self.startup_timings[
            "embedding_model_load"
        ] = round(
            perf_counter() - started,
            6,
        )

        return model

    def _load_reranker(
        self,
    ) -> CrossEncoder:
        started = perf_counter()

        model = CrossEncoder(
            self.config.reranker_model,
            device="cpu",
            local_files_only=True,
            max_length=self.config.reranker_max_length,
        )

        self.startup_timings[
            "reranker_model_load"
        ] = round(
            perf_counter() - started,
            6,
        )

        return model

    def _connect_weaviate(self):
        started = perf_counter()

        client = weaviate.connect_to_local()

        if not client.is_ready():
            client.close()

            raise RuntimeError(
                "Weaviate is not ready. "
                "Start Docker Desktop and weaviate-rag."
            )

        collection = client.collections.use(
            self.config.collection_name
        )

        self.startup_timings[
            "weaviate_connect"
        ] = round(
            perf_counter() - started,
            6,
        )

        return client, collection

    def _create_ollama_client(
        self,
    ) -> OllamaClient:
        started = perf_counter()

        client = OllamaClient(
            host=self.config.ollama_host,
            timeout=self.config.ollama_timeout,
        )

        self.startup_timings[
            "ollama_client_create"
        ] = round(
            perf_counter() - started,
            6,
        )

        return client

    def _warmup_ollama(self) -> None:
        started = perf_counter()

        self.ollama_client.generate(
            model=self.config.generation_model,
            prompt=" ",
            options={
                "num_predict": 1,
            },
            keep_alive=self.config.ollama_keep_alive,
        )

        self.startup_timings[
            "ollama_model_warmup"
        ] = round(
            perf_counter() - started,
            6,
        )

    @staticmethod
    def _normalize_question(
        question: str,
    ) -> str:
        return SPACE_RE.sub(
            " ",
            question,
        ).strip()

    def _embed_uncached(
        self,
        question: str,
    ) -> tuple[float, ...]:
        vector = self.embedding_model.embed_query(
            question
        )

        return tuple(vector)

    def _cache_get(
        self,
        key: str,
    ) -> dict[str, Any] | None:
        if self.config.answer_cache_size <= 0:
            return None

        with self._cache_lock:
            result = self._answer_cache.get(key)

            if result is None:
                return None

            self._answer_cache.move_to_end(key)

            return {
                **result,
                "retrieval_context": list(
                    result.get(
                        "retrieval_context",
                        [],
                    )
                ),
                "timings": dict(
                    result.get(
                        "timings",
                        {},
                    )
                ),
            }

    def _cache_put(
        self,
        key: str,
        result: dict[str, Any],
    ) -> None:
        if self.config.answer_cache_size <= 0:
            return

        with self._cache_lock:
            self._answer_cache[key] = {
                **result,
                "retrieval_context": list(
                    result.get(
                        "retrieval_context",
                        [],
                    )
                ),
                "timings": dict(
                    result.get(
                        "timings",
                        {},
                    )
                ),
            }

            self._answer_cache.move_to_end(key)

            while (
                len(self._answer_cache)
                > self.config.answer_cache_size
            ):
                self._answer_cache.popitem(
                    last=False
                )

    def _retrieve_chunks(
        self,
        question: str,
        profiler: Profiler,
    ) -> list[dict[str, Any]]:
        with profiler.measure(
            "question_embedding"
        ):
            query_vector = list(
                self._embed_cached(question)
            )

        with profiler.measure(
            "weaviate_retrieval"
        ):
            results = (
                self.collection.query.near_vector(
                    near_vector=query_vector,
                    target_vector="default",
                    limit=self.config.retrieval_top_k,
                    return_properties=[
                        "text",
                        "page_number",
                    ],
                )
            )

        chunks: list[dict[str, Any]] = []

        for result in results.objects:
            text = str(
                result.properties.get(
                    "text",
                    "",
                )
            ).strip()

            if not text:
                continue

            chunks.append(
                {
                    "text": text,
                    "page": int(
                        result.properties.get(
                            "page_number",
                            0,
                        )
                    ),
                }
            )

        return chunks

    def _rerank_chunks(
        self,
        question: str,
        chunks: list[dict[str, Any]],
        profiler: Profiler,
    ) -> list[dict[str, Any]]:
        pairs = [
            (
                question,
                chunk["text"],
            )
            for chunk in chunks
        ]

        with profiler.measure(
            "chunk_reranking"
        ):
            scores = self.reranker.predict(
                pairs,
                batch_size=(
                    self.config.rerank_batch_size
                ),
                show_progress_bar=False,
                convert_to_numpy=True,
            )

        ranked = [
            {
                **chunk,
                "semantic_score": float(score),
            }
            for chunk, score in zip(
                chunks,
                scores,
            )
        ]

        ranked.sort(
            key=lambda item: item[
                "semantic_score"
            ],
            reverse=True,
        )

        return ranked

    @staticmethod
    def _extract_passages(
        chunk: dict[str, Any],
    ) -> list[dict[str, Any]]:
        blocks = [
            " ".join(block.split())
            for block in chunk["text"].split(
                "\n\n"
            )
            if block.strip()
        ]

        passages: list[dict[str, Any]] = []
        heading: str | None = None

        for block in blocks:
            words = WORD_RE.findall(block)

            # Preserve the original heading heuristic.
            if (
                len(block) < 150
                and len(words) >= 3
            ):
                heading = block
                continue

            # Ignore short OCR noise.
            if len(block) < 60:
                continue

            if heading:
                passage_text = (
                    heading
                    + "\n"
                    + block
                )
            else:
                passage_text = block

            passages.append(
                {
                    "text": passage_text,
                    "page": chunk["page"],
                    "semantic_score": chunk[
                        "semantic_score"
                    ],
                }
            )

            heading = None

        return passages

    def _build_passages(
        self,
        ranked_chunks: list[dict[str, Any]],
        profiler: Profiler,
    ) -> list[dict[str, Any]]:
        with profiler.measure(
            "passage_extraction"
        ):
            unique: dict[
                str,
                dict[str, Any],
            ] = {}

            selected_chunks = ranked_chunks[
                : self.config.top_chunks_for_passages
            ]

            for chunk in selected_chunks:
                extracted = (
                    self._extract_passages(chunk)
                )

                if not extracted:
                    extracted = [
                        dict(chunk)
                    ]

                for passage in extracted:
                    key = passage[
                        "text"
                    ].casefold()

                    previous = unique.get(key)

                    if (
                        previous is None
                        or passage[
                            "semantic_score"
                        ]
                        > previous[
                            "semantic_score"
                        ]
                        or (
                            passage[
                                "semantic_score"
                            ]
                            == previous[
                                "semantic_score"
                            ]
                            and passage["page"]
                            < previous["page"]
                        )
                    ):
                        unique[key] = passage

            passages = list(
                unique.values()
            )

        if not passages:
            raise RuntimeError(
                "No useful passages were found "
                "after retrieval."
            )

        return passages

    def _select_best_passage(
        self,
        question: str,
        passages: list[dict[str, Any]],
        profiler: Profiler,
    ) -> tuple[
        dict[str, Any],
        list[dict[str, Any]],
    ]:
        if self.config.second_pass_rerank:
            pairs = [
                (
                    question,
                    passage["text"],
                )
                for passage in passages
            ]

            with profiler.measure(
                "passage_reranking"
            ):
                scores = self.reranker.predict(
                    pairs,
                    batch_size=(
                        self.config.rerank_batch_size
                    ),
                    show_progress_bar=False,
                    convert_to_numpy=True,
                )

            for passage, score in zip(
                passages,
                scores,
            ):
                passage[
                    "semantic_score"
                ] = float(score)

        else:
            profiler.timings[
                "passage_reranking"
            ] = 0.0

        with profiler.measure(
            "combined_scoring"
        ):
            question_words = {
                word.lower()
                for word in WORD_RE.findall(
                    question
                )
                if word.lower()
                not in STOP_WORDS
            }

            for passage in passages:
                heading = passage[
                    "text"
                ].split(
                    "\n",
                    1,
                )[0]

                heading_words = {
                    word.lower()
                    for word in WORD_RE.findall(
                        heading
                    )
                }

                passage_words = {
                    word.lower()
                    for word in WORD_RE.findall(
                        passage["text"]
                    )
                }

                heading_matches = len(
                    question_words
                    & heading_words
                )

                passage_matches = len(
                    question_words
                    & passage_words
                )

                score = (
                    passage["semantic_score"]
                    + 1.5 * heading_matches
                    + 0.20 * passage_matches
                )

                # Prevent active/passive confusion.
                if (
                    "active" in question_words
                    and "passive"
                    in heading_words
                ):
                    score -= 5.0

                if (
                    "passive" in question_words
                    and "active"
                    in heading_words
                ):
                    score -= 5.0

                passage[
                    "combined_score"
                ] = float(score)

            passages.sort(
                key=lambda item: item[
                    "combined_score"
                ],
                reverse=True,
            )

        return passages[0], passages

    def _generate_answer(
        self,
        question: str,
        best_passage: dict[str, Any],
        profiler: Profiler,
    ) -> str:
        page = best_passage["page"]
        passage_text = best_passage["text"]

        with profiler.measure(
            "prompt_construction"
        ):
            system_message = """
You are a precise extractive question-answering assistant.
Answer only using facts explicitly written in the supplied passage.

Rules:
- Write a natural and complete answer.
- Do not answer using only one word or a sentence fragment.
- Directly answer every part of the question.
- Include the method, action, frequency, and options when they appear.
- Preserve exact expressions such as "weekly, or more frequently".
- Do not claim that information is missing when it appears in the passage.
- Do not add information that is absent from the passage.
- Write one to three complete sentences.
- End the answer with: Source: Page <page number>.
""".strip()

            user_message = f"""
Question:
{question}

Passage:
Page {page}
{passage_text}

Write a complete answer that explains both what must be done and how often.
Do not respond with only a frequency.
""".strip()

        with profiler.measure(
            "ollama_generation"
        ):
            response = self.ollama_client.chat(
                model=(
                    self.config.generation_model
                ),
                messages=[
                    {
                        "role": "system",
                        "content": system_message,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    },
                ],
                options={
                    "temperature": 0.0,
                    "num_ctx": (
                        self.config.num_ctx
                    ),
                    "num_predict": (
                        self.config.num_predict
                    ),
                },
                keep_alive=(
                    self.config.ollama_keep_alive
                ),
            )

        return response.message.content.strip()

    def answer_question(
        self,
        question: str,
        *,
        use_cache: bool = True,
    ) -> dict[str, Any]:
        if self._closed:
            raise RuntimeError(
                "RAGService is already closed."
            )

        question = self._normalize_question(
            question
        )

        if not question:
            raise ValueError(
                "Question cannot be empty."
            )

        cache_key = question.casefold()
        request_started = perf_counter()

        if use_cache:
            cached = self._cache_get(
                cache_key
            )

            if cached is not None:
                elapsed = round(
                    perf_counter()
                    - request_started,
                    6,
                )

                cached["cache_hit"] = True

                cached["timings"] = {
                    "cache_lookup": elapsed,
                    "total": elapsed,
                }

                return cached

        # Heavy local inference is serialized to prevent
        # CPU and RAM contention.
        with self._inference_lock:
            if use_cache:
                cached = self._cache_get(
                    cache_key
                )

                if cached is not None:
                    elapsed = round(
                        perf_counter()
                        - request_started,
                        6,
                    )

                    cached["cache_hit"] = True

                    cached["timings"] = {
                        "cache_lookup": elapsed,
                        "total": elapsed,
                    }

                    return cached

            profiler = Profiler()

            chunks = self._retrieve_chunks(
                question,
                profiler,
            )

            if not chunks:
                result: dict[str, Any] = {
                    "answer": (
                        "No relevant passages "
                        "were found."
                    ),
                    "page": None,
                    "context": "",
                    "retrieval_context": [],
                    "cache_hit": False,
                    "timings": profiler.timings,
                }

            else:
                ranked_chunks = (
                    self._rerank_chunks(
                        question,
                        chunks,
                        profiler,
                    )
                )

                passages = (
                    self._build_passages(
                        ranked_chunks,
                        profiler,
                    )
                )

                (
                    best_passage,
                    ranked_passages,
                ) = self._select_best_passage(
                    question,
                    passages,
                    profiler,
                )

                answer = self._generate_answer(
                    question,
                    best_passage,
                    profiler,
                )

                result = {
                    "answer": answer,
                    "page": best_passage[
                        "page"
                    ],
                    "context": best_passage[
                        "text"
                    ],
                    "retrieval_context": [
                        (
                            f"Page "
                            f"{passage['page']}\n"
                            f"{passage['text']}"
                        )
                        for passage
                        in ranked_passages[:3]
                    ],
                    "cache_hit": False,
                    "timings": profiler.timings,
                }

            result["timings"]["total"] = round(
                perf_counter()
                - request_started,
                6,
            )

            if (
                use_cache
                and result["page"] is not None
            ):
                self._cache_put(
                    cache_key,
                    result,
                )

            return result

    def retrieve_only(
        self,
        question: str,
    ) -> dict[str, Any]:
        question = self._normalize_question(
            question
        )

        if not question:
            raise ValueError(
                "Question cannot be empty."
            )

        profiler = Profiler()

        chunks = self._retrieve_chunks(
            question,
            profiler,
        )

        profiler.timings["total"] = round(
            sum(profiler.timings.values()),
            6,
        )

        return {
            "chunks": chunks,
            "timings": profiler.timings,
        }

    def rank_only(
        self,
        question: str,
    ) -> dict[str, Any]:
        question = self._normalize_question(
            question
        )

        if not question:
            raise ValueError(
                "Question cannot be empty."
            )

        profiler = Profiler()

        chunks = self._retrieve_chunks(
            question,
            profiler,
        )

        if not chunks:
            return {
                "passages": [],
                "timings": profiler.timings,
            }

        ranked_chunks = self._rerank_chunks(
            question,
            chunks,
            profiler,
        )

        passages = self._build_passages(
            ranked_chunks,
            profiler,
        )

        _, ranked_passages = (
            self._select_best_passage(
                question,
                passages,
                profiler,
            )
        )

        profiler.timings["total"] = round(
            sum(profiler.timings.values()),
            6,
        )

        return {
            "passages": ranked_passages,
            "timings": profiler.timings,
        }

    def clear_caches(self) -> None:
        with self._cache_lock:
            self._answer_cache.clear()

        self._embed_cached.cache_clear()

    def close(self) -> None:
        if self._closed:
            return

        try:
            self.ollama_client.close()
        finally:
            self.weaviate_client.close()
            self._closed = True

    def __enter__(self) -> "RAGService":
        return self

    def __exit__(
        self,
        exc_type,
        exc_value,
        traceback,
    ) -> None:
        self.close()