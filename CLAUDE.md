# AI Development Instructions

## Project Purpose

This repository contains a full-stack local Retrieval-Augmented Generation application for answering questions about CIS Controls v8.

The application must remain grounded, traceable, local-first, and easy to test.

## Architecture

```text
React frontend
  ↓
ASP.NET Core middleware
  ↓
Python FastAPI RAG service
  ↓
Weaviate + Ollama

MongoDB stores:
- users
- conversations
- messages
- citations
- feedback
```

## Layer Responsibilities

### React

React is responsible for:

- Google Sign-In UI
- Chat rendering
- SSE consumption
- Conversation selection
- Citation rendering
- Regenerate controls
- Feedback controls
- Guided tour
- User-facing error states

React must not:

- Access MongoDB directly
- Access Weaviate directly
- Access Ollama directly
- Store server secrets
- Invent citations
- Perform authorization decisions

### ASP.NET Core

The middleware is responsible for:

- Google credential validation
- Application JWT creation
- Authentication and authorization
- User persistence
- Conversation ownership
- Message persistence
- Citation persistence
- Feedback persistence
- Python API proxying
- SSE forwarding
- Stable application API contracts

### Python

The Python service is responsible for:

- Query normalization
- Embedding
- Weaviate retrieval
- Passage extraction
- Cross-encoder reranking
- Domain-aware scoring
- Prompt construction
- Ollama generation
- Citation metadata creation
- Answer caching
- RAG timing information
- SSE event production

## RAG Rules

1. Answers must be grounded in retrieved source text.
2. Do not add unsupported factual claims.
3. Preserve structured citation metadata.
4. Do not create citation numbers that do not have a source object.
5. Regeneration must bypass the answer cache.
6. Retrieval metadata must remain available after persistence and reload.
7. Do not remove reranking without an evaluation showing an improvement.
8. Do not replace the embedding model without rebuilding the Weaviate collection.
9. Keep the Weaviate collection name consistent unless every dependent layer is updated.
10. Failed or interrupted streams must not be stored as successful complete answers.

## Current Models

```text
Embedding:
BAAI/bge-small-en-v1.5

Reranker:
cross-encoder/ms-marco-MiniLM-L4-v2

Generation:
qwen2.5:1.5b
```

## API Contracts

Python uses snake_case JSON fields:

```text
conversation_id
use_cache
retrieval_context
cache_hit
citation_id
```

Do not silently rename these fields in only one layer.

When a contract changes, inspect and update:

```text
Python response model
.NET application contract
.NET controller mapping
Domain entity
MongoDB document
Conversation response
Frontend service
React component
```

## Streaming Contract

Supported SSE events:

```text
status
metadata
token
done
error
```

SSE messages must end with a blank line:

```text
event: token
data: {"text":"example"}

```

Rules:

- `metadata` should arrive before generated tokens.
- `token` events append text.
- `done` contains final metadata and timings.
- `error` must display a readable user-facing message.
- Unknown event types should be ignored safely.
- Do not persist a successful answer before `done`.

## Authentication and Secrets

Never commit:

```text
frontend/.env
MongoDB passwords
JWT signing keys
Google client secrets
User Secrets output
API keys
private certificates
access tokens
```

The Google OAuth client ID may appear in local configuration, but the client secret must never reach React.

Development currently supports a compatibility `X-User-Id` header. Production authorization should use the validated JWT subject claim only.

Do not remove the development fallback until the protected controllers and frontend services are migrated and tested together.

## Code Style

### Python

- Use type hints.
- Use explicit exception handling.
- Keep reusable RAG logic inside `src/rag_service.py`.
- Keep FastAPI routing and HTTP response concerns inside `main.py`.
- Do not initialize large models per request.
- Close Weaviate and Ollama clients during application shutdown.
- Preserve offline-compatible model loading.

### C#

- Use nullable reference types correctly.
- Use asynchronous database and HTTP operations.
- Pass cancellation tokens.
- Keep API contracts in the Application project.
- Keep database documents and repositories in Infrastructure.
- Keep business entities in Domain.
- Keep controllers thin where practical.
- Validate ownership before reading or updating data.
- Use UTC timestamps.

### React

- Keep HTTP logic in `src/services`.
- Keep UI components in `src/components`.
- Do not place secrets in browser code.
- Preserve loading, streaming, empty, and error states.
- Disable duplicate actions during active requests.
- Keep citation and feedback controls keyboard accessible.
- Use `npm.cmd` in Windows PowerShell documentation.

## Comments

Comments should explain:

- Why a decision exists
- Security boundaries
- Streaming edge cases
- Persistence timing
- Non-obvious scoring behavior

Do not add comments that only repeat the code.

## Required Validation

Before accepting a Python change:

```powershell
uv run python -m py_compile `
  main.py `
  src\rag_service.py
```

Before accepting a .NET change:

```powershell
cd middleware

dotnet build .\RagMiddleware.sln
```

Before accepting a React change:

```powershell
cd frontend

npm.cmd run build
```

## Happy-Path Test

Every user-facing release must test:

1. Sign in with Google.
2. Complete or skip the tour.
3. Create a conversation.
4. Send a question.
5. Observe streamed status and tokens.
6. Verify inline citation.
7. Verify source page and excerpt.
8. Verify retrieval metadata.
9. Regenerate the answer.
10. Submit feedback.
11. Refresh the browser.
12. Resume the conversation.
13. Verify messages, citations, and feedback persist.
14. Sign out and sign in again.

## Git Rules

- Work on a feature branch.
- Keep commits focused and meaningful.
- Do not commit generated build folders.
- Do not commit `.env` files.
- Do not commit secret values.
- Review `git diff` before staging.
- Run all three builds before pushing.
- Open a pull request against `main`.
- Include testing evidence in the pull request description.

Suggested commit style:

```text
feat: add persistent answer feedback
fix: preserve citation metadata after reload
docs: finalize full-stack setup guide
refactor: separate RAG scoring from generation
test: add RAG evaluation cases
```

## AI-Assisted Development Policy

AI tools may help with:

- Boilerplate
- Refactoring
- Debugging
- Documentation
- Test design
- Architecture review
- Error interpretation

AI-generated changes must not be accepted automatically.

For every generated change:

1. Compare it with the existing architecture.
2. Check filenames, namespaces, imports, and contracts.
3. Inspect security implications.
4. Build the affected layer.
5. Test the full flow when behavior changes.
6. Review the final diff manually.

AI output is a development aid, not the source of truth. The repository code, requirements, test results, and source documents remain authoritative.