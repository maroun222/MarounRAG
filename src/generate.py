"""
Interactive terminal interface for the optimized RAG service.
"""

from rag_service import RAGService


def print_timings(
    timings: dict[str, float],
) -> None:
    """Print the measured time of each pipeline stage."""

    print("\nStage timings:")

    for stage_name, seconds in timings.items():
        print(
            f"  {stage_name:22s} "
            f"{seconds:8.3f} seconds"
        )


def main() -> None:
    print(
        "Loading the embedding model, reranker, "
        "Weaviate connection, and Ollama client..."
    )

    with RAGService() as rag:
        print("\nRAG system ready.")

        print("\nStartup timings:")

        for stage_name, seconds in (
            rag.startup_timings.items()
        ):
            print(
                f"  {stage_name:22s} "
                f"{seconds:8.3f} seconds"
            )

        while True:
            question = input(
                "\nEnter your question, "
                "or type 'exit': "
            ).strip()

            if question.lower() in {
                "exit",
                "quit",
            }:
                break

            if not question:
                continue

            try:
                result = rag.answer_question(
                    question
                )

            except Exception as error:
                print(
                    "\nAn error occurred:",
                    error,
                )
                continue

            print(
                "\nBest passage sent "
                "to the model:"
            )
            print("=" * 70)
            print("Page:", result["page"])
            print(result["context"])

            print("\nGenerated answer:")
            print("=" * 70)
            print(result["answer"])

            print(
                "\nAnswer cache hit:",
                result["cache_hit"],
            )

            print_timings(
                result["timings"]
            )

    print("\nProgram closed.")


if __name__ == "__main__":
    main()