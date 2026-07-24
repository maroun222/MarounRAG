"""
Profile the RAG pipeline stage by stage.

The results are also saved to:
artifacts/rag_profile.json
"""

import json
from pathlib import Path
from statistics import mean

from rag_service import RAGService


QUESTIONS = [
    (
        "How should unauthorized enterprise "
        "assets be handled?"
    ),
    (
        "How frequently should an active "
        "discovery tool run?"
    ),
    (
        "How often should DHCP logs update "
        "the enterprise asset inventory?"
    ),
    (
        "What information must the enterprise "
        "asset inventory contain?"
    ),
]


def main() -> None:
    project_path = (
        Path(__file__)
        .resolve()
        .parent
        .parent
    )

    output_path = (
        project_path
        / "artifacts"
        / "rag_profile.json"
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    runs: list[dict] = []

    with RAGService() as rag:
        print("\nStartup timings:")

        for stage, seconds in (
            rag.startup_timings.items()
        ):
            print(
                f"  {stage:22s} "
                f"{seconds:8.3f} seconds"
            )

        for question in QUESTIONS:
            print("\n" + "=" * 80)
            print("Profiling question:")
            print(question)

            # Disable complete-answer caching so the real
            # pipeline runs for every question.
            result = rag.answer_question(
                question,
                use_cache=False,
            )

            runs.append(
                {
                    "question": question,
                    "page": result["page"],
                    "answer": result["answer"],
                    "timings": result["timings"],
                }
            )

            print("\nSelected page:", result["page"])

            print("\nGenerated answer:")
            print(result["answer"])

            print("\nTimings:")

            for stage, seconds in (
                result["timings"].items()
            ):
                print(
                    f"  {stage:22s} "
                    f"{seconds:8.3f} seconds"
                )

        stage_names = sorted(
            {
                stage_name
                for run in runs
                for stage_name in (
                    run["timings"].keys()
                )
            }
        )

        average_timings = {}

        for stage_name in stage_names:
            values = [
                run["timings"].get(
                    stage_name,
                    0.0,
                )
                for run in runs
            ]

            average_timings[
                stage_name
            ] = round(
                mean(values),
                6,
            )

        report = {
            "startup_timings": (
                rag.startup_timings
            ),
            "average_query_timings": (
                average_timings
            ),
            "runs": runs,
        }

    with open(
        output_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            report,
            file,
            indent=2,
            ensure_ascii=False,
        )

    print("\n" + "=" * 80)
    print("Average query timings:")

    for stage, seconds in (
        average_timings.items()
    ):
        print(
            f"  {stage:22s} "
            f"{seconds:8.3f} seconds"
        )

    print("\nProfile saved to:")
    print(output_path)


if __name__ == "__main__":
    main()