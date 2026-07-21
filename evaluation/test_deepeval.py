from deepeval import evaluate
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    ContextualRelevancyMetric,
    HallucinationMetric,
)
from deepeval.models import OllamaModel
from deepeval.test_case import LLMTestCase


# Qwen is used only as the evaluation judge
judge_model = OllamaModel(
    model="qwen2.5:1.5b",
    base_url="http://localhost:11434",
    temperature=0,
)


# User question
question = (
    "How often should DHCP logs be used to update "
    "the enterprise asset inventory?"
)


# Answer produced by the RAG system
# We remove "(Page 19)" here so the evaluation focuses on answer quality.
actual_answer = (
    "DHCP logs should be reviewed and used to update the "
    "enterprise asset inventory weekly, or more frequently."
)


# Manually verified correct answer
expected_answer = (
    "DHCP logs should be reviewed and used to update the "
    "enterprise asset inventory weekly, or more frequently."
)


# Passage retrieved from the CIS Controls PDF
retrieved_passage = """
Page 19

Use Dynamic Host Configuration Protocol (DHCP) Logging to
Update Enterprise Asset Inventory.

Use DHCP logging on all DHCP servers or Internet Protocol
address management tools to update the enterprise's asset
inventory. Review and use logs to update the enterprise's
asset inventory weekly, or more frequently.
"""


# One DeepEval test case
test_case = LLMTestCase(
    input=question,
    actual_output=actual_answer,
    expected_output=expected_answer,

    # Passages returned by the RAG retriever
    retrieval_context=[
        retrieved_passage,
    ],

    # Trusted reference information used for hallucination checking
    context=[
        retrieved_passage,
    ],
)


# Generator evaluation:
# Is the answer supported by the retrieved passage?
faithfulness = FaithfulnessMetric(
    threshold=0.5,
    model=judge_model,
    include_reason=True,
    async_mode=False,
)


# Generator evaluation:
# Does the answer directly answer the user's question?
answer_relevancy = AnswerRelevancyMetric(
    threshold=0.5,
    model=judge_model,
    include_reason=True,
    async_mode=False,
)


# Retriever evaluation:
# Are the most relevant retrieved passages ranked first?
contextual_precision = ContextualPrecisionMetric(
    threshold=0.5,
    model=judge_model,
    include_reason=True,
    async_mode=False,
)


# Retriever evaluation:
# Does the retrieved context contain the information needed
# to produce the expected answer?
contextual_recall = ContextualRecallMetric(
    threshold=0.5,
    model=judge_model,
    include_reason=True,
    async_mode=False,
)


# Retriever evaluation:
# Is the retrieved passage relevant to the question?
contextual_relevancy = ContextualRelevancyMetric(
    threshold=0.5,
    model=judge_model,
    include_reason=True,
    async_mode=False,
)


# Generator evaluation:
# Does the answer contradict or add unsupported information?
# For this metric, a lower score is better.
hallucination = HallucinationMetric(
    threshold=0.5,
    model=judge_model,
    include_reason=True,
    async_mode=False,
)


# Run all six metrics
evaluate(
    test_cases=[
        test_case,
    ],
    metrics=[
        faithfulness,
        answer_relevancy,
        contextual_precision,
        contextual_recall,
        contextual_relevancy,
        hallucination,
    ],
)