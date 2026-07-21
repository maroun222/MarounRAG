import json
from pathlib import Path


project_path = Path(__file__).resolve().parent.parent

dataset_path = (
    project_path
    / "evaluation"
    / "golden_dataset.json"
)


with open(dataset_path, "r", encoding="utf-8") as file:
    golden_data = json.load(file)


print("Number of evaluation cases:", len(golden_data))

for case in golden_data:
    print("\n" + "=" * 60)
    print("ID:", case["id"])
    print("Question:", case["question"])
    print("Expected answer:", case["expected_answer"])
    print("Expected page:", case["expected_page"])
    print("Expected safeguard:", case["expected_safeguard"])