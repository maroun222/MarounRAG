#Parsed the PDF, extracted its content using Unstructured, 
# removed very short, useless data, then saved the results in parsed_documents.pkl

import os
import pickle
import time
from pathlib import Path

import unstructured_pytesseract.pytesseract as pytesseract
from langchain_unstructured import UnstructuredLoader


# Project folder
project_path = Path(__file__).resolve().parent.parent

# PDF path
pdf_path = (
    project_path
    / "data"
    / "CIS_Controls__v8__Critical_Security_Controls__2023_08.pdf"
)

# Tesseract path
tesseract_folder = r"C:\Program Files\Tesseract-OCR"
tesseract_path = rf"{tesseract_folder}\tesseract.exe"

os.environ["PATH"] = tesseract_folder + os.pathsep + os.environ["PATH"]
pytesseract.tesseract_cmd = tesseract_path

print("PDF found:", pdf_path.exists())
print("Parsing started...")

start_time = time.time()

# Configure parser
loader = UnstructuredLoader(
    file_path=str(pdf_path),
    partition_via_api=False,
    strategy="hi_res",
    languages=["eng"],
    infer_table_structure=True,
)

# Parse PDF
documents = loader.load()

# Remove obvious small OCR noise
clean_documents = [
    document
    for document in documents
    if (
        document.page_content.strip()
        and (
            document.metadata.get("category")
            in {"Title", "NarrativeText", "ListItem", "Table"}
            or (
                document.metadata.get("category") == "UncategorizedText"
                and len(document.page_content.strip()) >= 10
            )
        )
    )
]

print("Original elements:", len(documents))
print("Clean elements:", len(clean_documents))
print("Parsing time:", round(time.time() - start_time, 1), "seconds")

# Create artifacts folder
artifacts_path = project_path / "artifacts"
artifacts_path.mkdir(exist_ok=True)

# Save results
output_path = artifacts_path / "parsed_documents.pkl"

with open(output_path, "wb") as file:
    pickle.dump(
        {
            "documents": documents,
            "clean_documents": clean_documents,
        },
        file,
    )

print("Saved to:", output_path)