#Weaviate compares the vectors of the questions and the stored chunks vectors, returns 10 chunks with the closest meaning, 
# this is semantic retreival which means to search by meaning, not only words

import time

import weaviate
from langchain_huggingface import HuggingFaceEmbeddings
from weaviate.classes.query import MetadataQuery


# Load the same model used for the document chunks
embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

question = "How should unauthorized enterprise assets be handled?"

query_vector = embedding_model.embed_query(question)

print("Question:", question)
print("Query vector dimension:", len(query_vector))


client = weaviate.connect_to_local()

try:
    collection = client.collections.use("CISControls")

    count = collection.aggregate.over_all(total_count=True)

    print("Weaviate ready:", client.is_ready())
    print("Objects in collection:", count.total_count)

    # Check that a vector is actually stored
    sample = next(collection.iterator(include_vector=True))

    print("Stored vector names:", list(sample.vector.keys()))

    stored_vector = sample.vector.get("default")

    if stored_vector is None:
        print("No vector was found in the stored object.")
    else:
        print("Stored vector dimension:", len(stored_vector))

    # Give the vector index time to become ready
    time.sleep(3)

    results = collection.query.near_vector(
        near_vector=query_vector,
        target_vector="default",
        limit=3,
        return_properties=["text", "page_number", "source"],
        return_metadata=MetadataQuery(distance=True),
    )

    print("Results returned:", len(results.objects))

    for number, result in enumerate(results.objects, start=1):
        print("\n" + "=" * 70)
        print("Result:", number)
        print("Page:", result.properties.get("page_number"))
        print("Distance:", result.metadata.distance)
        print("Text:")
        print(result.properties.get("text", "")[:1000])

finally:
    client.close()
    print("\nConnection closed")