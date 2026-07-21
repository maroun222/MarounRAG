#We used BAAI/bge-small-en-v1.5 as an embedding model, which
# converts text chunk into a vector, saved in embedded_chunks

import pickle
from pathlib import Path

from langchain_huggingface import HuggingFaceEmbeddings


project_path = Path(__file__).resolve().parent.parent

input_path = project_path / "artifacts" / "chunks.pkl"
output_path = project_path / "artifacts" / "embedded_chunks.pkl"


# Load chunks
with open(input_path, "rb") as file:
    chunks = pickle.load(file)

print("Chunks loaded:", len(chunks))


# Load the local embedding model
embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

print("Embedding model loaded")


# Get the text from every chunk
texts = []

for chunk in chunks:
    texts.append(chunk.page_content)


# Convert chunks into vectors
vectors = embedding_model.embed_documents(texts)

print("Vectors created:", len(vectors))
print("Vector dimension:", len(vectors[0]))


# Save chunks and vectors
with open(output_path, "wb") as file:
    pickle.dump(
        {
            "chunks": chunks,
            "vectors": vectors,
        },
        file,
    )

print("Saved to:", output_path)