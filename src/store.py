#We stored chunk text, chunk vector, page number and source file in Weaviate,
# that runs inside docker and acts as a vector database

import pickle
from pathlib import Path

import weaviate
from weaviate.classes.config import Configure, DataType, Property


project_path = Path(__file__).resolve().parent.parent
input_path = project_path / "artifacts" / "embedded_chunks.pkl"


# Load chunks and their vectors
with open(input_path, "rb") as file:
    data = pickle.load(file)

chunks = data["chunks"]
vectors = data["vectors"]

print("Chunks loaded:", len(chunks))
print("Vectors loaded:", len(vectors))


# Connect to Weaviate running in Docker
client = weaviate.connect_to_local()

print("Weaviate ready:", client.is_ready())


collection_name = "CISControls"


# Remove the old collection when rerunning
if client.collections.exists(collection_name):
    client.collections.delete(collection_name)
    print("Old collection deleted")


# Create the collection
client.collections.create(
    name=collection_name,
    vector_config=Configure.Vectors.self_provided(),
    properties=[
        Property(name="text", data_type=DataType.TEXT),
        Property(name="page_number", data_type=DataType.INT),
        Property(name="source", data_type=DataType.TEXT),
    ],
)

collection = client.collections.use(collection_name)

print("Collection created:", collection_name)


# Insert every chunk and its vector
with collection.batch.dynamic() as batch:
    for chunk, vector in zip(chunks, vectors):
        batch.add_object(
            properties={
                "text": chunk.page_content,
                "page_number": int(
                    chunk.metadata.get("page_number", 0)
                ),
                "source": str(
                    chunk.metadata.get("source", "")
                ),
            },
            vector=vector,
        )


# Count stored objects
result = collection.aggregate.over_all(total_count=True)

print("Objects stored:", result.total_count)

client.close()

print("Connection closed")