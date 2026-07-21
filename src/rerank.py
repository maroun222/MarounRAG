#We use cross-encoder/ms-marco-MiniLM-L4-v2 that give a semantic score, that tells whether
# the passage is relevant to the question or not
#  we then added a combined score, that helps to choose a better passage

import weaviate

from langchain_huggingface import HuggingFaceEmbeddings
from sentence_transformers import CrossEncoder
from weaviate.classes.query import MetadataQuery


# Test question
question = "How should unauthorized enterprise assets be handled?"


# Same embedding model used for the document chunks
embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

# Convert the question into a vector
query_vector = embedding_model.embed_query(question)


# Connect to Weaviate
client = weaviate.connect_to_local()
collection = client.collections.use("CISControls")


# Retrieve the 10 most similar chunks
results = collection.query.near_vector(
    near_vector=query_vector,
    target_vector="default",
    limit=10,
    return_properties=["text", "page_number", "source"],
    return_metadata=MetadataQuery(distance=True),
)

client.close()

print("Question:", question)
print("Retrieved candidates:", len(results.objects))


# Load the smaller reranking model
reranker = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L4-v2",
    device="cpu",
)

print("Reranking model loaded")


# Create question-chunk pairs
pairs = []

for result in results.objects:
    chunk_text = result.properties.get("text", "")
    pairs.append([question, chunk_text])


# Give every chunk a relevance score
scores = reranker.predict(pairs)


# Combine the retrieved chunks with their scores
ranked_results = list(zip(results.objects, scores))


# Higher reranking score means more relevant
ranked_results.sort(
    key=lambda item: float(item[1]),
    reverse=True,
)


# Display the best 3 chunks
print("\nTop 3 results after reranking:")

for rank, (result, score) in enumerate(
    ranked_results[:3],
    start=1,
):
    print("\n" + "=" * 70)
    print("Rank:", rank)
    print("Page:", result.properties.get("page_number"))
    print("Reranking score:", float(score))
    print("Original vector distance:", result.metadata.distance)
    print("Text:")
    print(result.properties.get("text", "")[:1200])