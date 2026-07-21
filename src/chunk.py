#We grouped the extracted text by page, then used recursive character chunking
# where the following chunk repeats 150 characters from the previous,
#  saved in chunks.pkl

import pickle
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


project_path = Path(__file__).resolve().parent.parent

input_path = project_path / "artifacts" / "parsed_documents.pkl"
output_path = project_path / "artifacts" / "chunks.pkl"


# Load parsed documents
with open(input_path, "rb") as file:
    data = pickle.load(file)

clean_documents = data["clean_documents"]

print("Clean elements loaded:", len(clean_documents))


# Group the elements by page
# 1. Create and fill pages
pages = {}

for document in clean_documents:
    page_number = int(document.metadata.get("page_number", 0))

    if page_number not in pages:
        pages[page_number] = []

    pages[page_number].append(document.page_content.strip())


# 2. Check missing pages only after pages is filled
all_pages = set(range(1, 83))
kept_pages = set(pages.keys())

print("Pages without clean content:", sorted(all_pages - kept_pages))


# 3. Create page documents
page_documents = []

for page_number, texts in pages.items():
    page_text = "\n\n".join(texts)

    page_documents.append(
        Document(
            page_content=page_text,
            metadata={
                "page_number": page_number,
                "source": clean_documents[0].metadata.get("filename"),
            },
        )
    )

print("Page documents:", len(page_documents))


# Split pages into smaller chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
)

chunks = splitter.split_documents(page_documents)

print("Chunks created:", len(chunks))


# Save chunks
with open(output_path, "wb") as file:
    pickle.dump(chunks, file)

print("Saved to:", output_path)