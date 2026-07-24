# CIS Controls Local RAG Assistant

A full-stack Retrieval-Augmented Generation application for asking natural-language questions about the CIS Controls v8 document.

The system retrieves relevant passages, reranks them, generates a locally grounded answer, streams the answer to the browser, and displays citations with supporting source text.

## Features

- Google Sign-In
- Local application JWT generation
- Streaming answers using Server-Sent Events
- Semantic retrieval from Weaviate
- Cross-encoder passage reranking
- Local answer generation through Ollama
- Inline citations and source cards
- Source page and supporting passage
- Retrieval metadata and timing information
- MongoDB conversation persistence
- Resume previous conversations
- Regenerate answers without using the answer cache
- Helpful and Not Helpful feedback
- Persistent feedback state
- First-time guided tour
- Local inference without a paid language-model API

## Architecture

```text
User
  |
  v
React + Vite frontend
http://localhost:5173
  |
  v
ASP.NET Core middleware
http://127.0.0.1:5050
  |-- Google authentication
  |-- JWT generation
  |-- Conversation ownership
  |-- MongoDB persistence
  |-- Feedback persistence
  |-- SSE proxying
  |
  v
Python FastAPI RAG service
http://127.0.0.1:8000
  |-- BGE query embedding
  |-- Weaviate retrieval
  |-- MiniLM cross-encoder reranking
  |-- Prompt construction
  |-- Ollama generation
  |
  +--> Weaviate
  +--> Ollama
```

## RAG Pipeline

```text
Question
  |
  v
BAAI/bge-small-en-v1.5 embedding
  |
  v
Top-k vector retrieval from Weaviate
  |
  v
cross-encoder/ms-marco-MiniLM-L4-v2 reranking
  |
  v
Domain-aware passage scoring
  |
  v
Grounded prompt construction
  |
  v
qwen2.5:1.5b through Ollama
  |
  v
Streamed answer + citation + source metadata
```

## Technology Stack

### Frontend

- React
- Vite
- Tailwind CSS
- React Markdown
- Google Identity Services
- Server-Sent Events

### Middleware

- ASP.NET Core 10
- C#
- MongoDB Driver
- Google token validation
- JWT Bearer Authentication
- Typed HTTP clients

### RAG service

- Python 3.12+
- FastAPI
- LangChain
- Sentence Transformers
- BAAI/bge-small-en-v1.5
- cross-encoder/ms-marco-MiniLM-L4-v2
- Ollama
- qwen2.5:1.5b

### Data stores

- Weaviate: document chunks and vectors
- MongoDB: users, conversations, messages, sources, and feedback

---

# Quick Start

The normal startup takes less than five minutes after the one-time model and document-ingestion setup has been completed.

## Prerequisites

Install:

- Git
- Python 3.12 or newer
- uv
- Node.js
- .NET 10 SDK
- Docker Desktop
- Ollama
- Tesseract OCR for the first document-ingestion run

## 1. Clone the repository

```powershell
git clone https://github.com/maroun222/MarounRAG.git

cd MarounRAG

git checkout feature/dotnet-middleware
```

## 2. Install dependencies

### Python

From the repository root:

```powershell
uv sync
```

### React

```powershell
cd .\frontend

npm.cmd install

cd ..
```

### .NET

```powershell
cd .\middleware

dotnet restore .\RagMiddleware.sln

cd ..
```

## 3. Pull the Ollama model

```powershell
ollama pull qwen2.5:1.5b
```

Verify it:

```powershell
ollama list
```

## 4. Start the databases

Create the containers once:

```powershell
docker run `
  --detach `
  --name weaviate-rag `
  --publish 8080:8080 `
  --publish 50051:50051 `
  --env QUERY_DEFAULTS_LIMIT=25 `
  --env AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true `
  --env PERSISTENCE_DATA_PATH=/var/lib/weaviate `
  --env CLUSTER_HOSTNAME=node1 `
  --volume weaviate_rag_data:/var/lib/weaviate `
  cr.weaviate.io/semitechnologies/weaviate:1.27.0
```

```powershell
docker run `
  --detach `
  --name mongodb-rag `
  --publish 27017:27017 `
  --volume mongodb_rag_data:/data/db `
  mongo:8.0
```

For later runs, use:

```powershell
docker start weaviate-rag mongodb-rag
```

## 5. Configure the frontend

Copy the example environment file:

```powershell
Copy-Item `
  .\frontend\.env.example `
  .\frontend\.env
```

Open:

```text
frontend/.env
```

Use:

```env
VITE_API_URL=http://127.0.0.1:5050
VITE_DEV_USER_ID=local-dev-user
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

Do not commit `frontend/.env`.

## 6. Configure Google OAuth

Create a Google OAuth 2.0 Client ID with application type:

```text
Web application
```

Add these Authorized JavaScript origins:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Copy the client ID into:

```text
frontend/.env
```

The same client ID must also be stored in the .NET User Secrets configuration.

## 7. Configure .NET User Secrets

Move to the API project:

```powershell
cd .\middleware\RagMiddleware.Api
```

Initialize User Secrets when needed:

```powershell
dotnet user-secrets init
```

Configure the Python service:

```powershell
dotnet user-secrets set `
  "RagApi:BaseUrl" `
  "http://127.0.0.1:8000"
```

Configure MongoDB:

```powershell
dotnet user-secrets set `
  "MongoDb:ConnectionString" `
  "mongodb://127.0.0.1:27017"
```

```powershell
dotnet user-secrets set `
  "MongoDb:DatabaseName" `
  "cis_controls_rag"
```

Configure Google authentication:

```powershell
dotnet user-secrets set `
  "GoogleAuth:ClientId" `
  "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
```

Generate a secure JWT signing key:

```powershell
$jwtKeyBytes = New-Object byte[] 64

$rng = [
  System.Security.Cryptography.RandomNumberGenerator
]::Create()

try {
    $rng.GetBytes($jwtKeyBytes)
}
finally {
    $rng.Dispose()
}

$jwtSigningKey = [
  Convert
]::ToBase64String($jwtKeyBytes)
```

Store the JWT settings:

```powershell
dotnet user-secrets set `
  "Jwt:SigningKey" `
  $jwtSigningKey
```

```powershell
dotnet user-secrets set `
  "Jwt:Issuer" `
  "RagMiddleware"
```

```powershell
dotnet user-secrets set `
  "Jwt:Audience" `
  "CisControlsFrontend"
```

```powershell
dotnet user-secrets set `
  "Jwt:LifetimeMinutes" `
  "120"
```

Remove the temporary PowerShell value:

```powershell
Remove-Variable `
  jwtSigningKey,
  jwtKeyBytes,
  rng `
  -ErrorAction SilentlyContinue
```

Return to the repository root:

```powershell
cd ..\..
```

Never commit passwords, OAuth client secrets, JWT signing keys, `.env` files, or User Secrets output.

---

# One-Time Document Ingestion

The RAG service expects a Weaviate collection named:

```text
CISControls
```

The source PDF is located at:

```text
data/CIS_Controls__v8__Critical_Security_Controls__2023_08.pdf
```

The ingestion stages are:

```text
PDF
→ parse
→ chunk
→ embed
→ store in Weaviate
```

## Tesseract configuration

The current Windows parsing script expects Tesseract at:

```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

Update `src/parse.py` when Tesseract is installed elsewhere.

## Run the ingestion pipeline

Make sure Weaviate is running:

```powershell
docker start weaviate-rag
```

Then run:

```powershell
uv run python .\src\parse.py
```

```powershell
uv run python .\src\chunk.py
```

```powershell
uv run python .\src\embed.py
```

```powershell
uv run python .\src\store.py
```

This process creates local artifacts and inserts the document vectors into the `CISControls` collection.

Document parsing and model downloads are one-time operations and may take longer than the normal application startup.

---

# Run the Full Stack

Open three PowerShell terminals.

## Terminal 1: Python RAG API

```powershell
cd C:\path\to\MarounRAG

docker start weaviate-rag mongodb-rag

$env:HF_HUB_OFFLINE="1"
$env:TRANSFORMERS_OFFLINE="1"

uv run python -m uvicorn main:app `
  --host 127.0.0.1 `
  --port 8000
```

Expected address:

```text
http://127.0.0.1:8000
```

Health endpoint:

```text
http://127.0.0.1:8000/health
```

## Terminal 2: ASP.NET Core middleware

```powershell
cd C:\path\to\MarounRAG\middleware

$env:ASPNETCORE_ENVIRONMENT="Development"

dotnet run `
  --project .\RagMiddleware.Api\RagMiddleware.Api.csproj `
  --urls http://127.0.0.1:5050
```

Expected address:

```text
http://127.0.0.1:5050
```

## Terminal 3: React frontend

```powershell
cd C:\path\to\MarounRAG\frontend

npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

---

# Happy-Path Test

1. Sign in using Google.
2. Complete or skip the guided tour.
3. Select New conversation.
4. Ask:

```text
How should unauthorized enterprise assets be handled?
```

5. Confirm the answer streams progressively.
6. Confirm citation `[1]` appears.
7. Confirm the source card shows the document and page.
8. Expand retrieval metadata.
9. Select Regenerate.
10. Confirm the pipeline runs again.
11. Select Helpful or Not helpful.
12. Refresh the page.
13. Reopen the conversation.
14. Confirm messages, citations, and feedback remain saved.
15. Sign out and sign in again.

---

# Build and Validation

## Python syntax validation

```powershell
uv run python -m py_compile `
  main.py `
  src\rag_service.py
```

## .NET build

```powershell
cd .\middleware

dotnet build .\RagMiddleware.sln
```

## React production build

```powershell
cd ..\frontend

npm.cmd run build
```

---

# API Overview

## Python FastAPI

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Python RAG health check |
| POST | `/chat` | Complete non-streaming answer |
| POST | `/chat/stream` | SSE-streamed answer |

## ASP.NET Core middleware

| Endpoint group | Purpose |
|---|---|
| `/health` | Middleware health check |
| `/api/auth` | Google login and application JWT |
| `/api/rag` | Normal and streaming RAG proxy |
| `/api/conversations` | Conversation persistence |
| `/api/feedback` | Helpful and Not Helpful feedback |

---

# Server-Sent Events

The streaming endpoint emits:

```text
status
metadata
token
done
error
```

Example:

```text
event: token
data: {"text":"Unauthorized"}
```

The React frontend parses these events and updates the answer progressively.

---

# Project Structure

```text
MarounRAG/
├── data/
│   └── CIS_Controls__v8__Critical_Security_Controls__2023_08.pdf
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── middleware/
│   ├── RagMiddleware.Api/
│   ├── RagMiddleware.Application/
│   ├── RagMiddleware.Domain/
│   ├── RagMiddleware.Infrastructure/
│   └── RagMiddleware.sln
│
├── notebooks/
│   └── 01_RAG_setup.ipynb
│
├── src/
│   ├── parse.py
│   ├── chunk.py
│   ├── embed.py
│   ├── store.py
│   ├── retrieve.py
│   ├── rerank.py
│   ├── generate.py
│   └── rag_service.py
│
├── main.py
├── CLAUDE.md
├── pyproject.toml
├── uv.lock
└── README.md
```

---

# Important Design Decision

React does not communicate directly with the Python service.

The ASP.NET Core middleware separates application concerns from AI concerns:

- .NET handles authentication.
- .NET handles users and ownership.
- .NET stores conversations and feedback.
- .NET proxies and observes the SSE stream.
- Python focuses on retrieval, reranking, and generation.
- Secrets are not exposed to the browser.
- The model and vector database can be changed without redesigning the frontend.

---

# AI Tooling Usage

AI-assisted development was used for:

- Architecture review
- Python, React, C#, and PowerShell debugging
- Contract and model generation
- SSE integration
- Code refactoring
- Documentation drafting
- Test-case preparation
- Security review
- Error-handling improvements

All generated code was manually reviewed, adapted to the existing project, compiled, and tested before being accepted.

The repository includes `CLAUDE.md` as the checked-in AI customization artifact.

---

# Development Security Note

The development frontend currently sends:

```http
Authorization: Bearer <application-token>
X-User-Id: local-dev-user
```

Google authentication and application JWT generation are implemented.

The development ownership header remains temporarily enabled for compatibility with the current RAG, conversation, and feedback controllers. A production deployment should derive ownership only from the validated JWT subject claim and should remove the development header.

Production deployment also requires:

- HTTPS
- Restricted CORS origins
- Secure token or HttpOnly cookie handling
- Secret rotation
- Production MongoDB authentication
- Rate limiting
- Centralized audit logging

---

# Troubleshooting

## `The RAG streaming service is unavailable`

Confirm:

```text
Python: 127.0.0.1:8000
.NET:   127.0.0.1:5050
React:  localhost:5173
Ollama: 127.0.0.1:11434
```

Check containers:

```powershell
docker ps
```

Start them:

```powershell
docker start weaviate-rag mongodb-rag
```

## `Weaviate is not ready`

Start Docker Desktop and run:

```powershell
docker start weaviate-rag
```

## Ollama model not found

```powershell
ollama pull qwen2.5:1.5b
```

## Hugging Face model unavailable in offline mode

Temporarily remove the offline environment variables and run the embedding stage once:

```powershell
Remove-Item Env:HF_HUB_OFFLINE `
  -ErrorAction SilentlyContinue

Remove-Item Env:TRANSFORMERS_OFFLINE `
  -ErrorAction SilentlyContinue

uv run python .\src\embed.py
```

After the models are cached, restart Python using offline mode.

## Google `origin_mismatch`

Add both origins to the OAuth web client:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Confirm that `frontend/.env` uses the same OAuth client ID.

## PowerShell blocks `npm`

Use:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Port already in use

Find the process:

```powershell
Get-NetTCPConnection `
  -LocalPort 5173,5050,8000 `
  -ErrorAction SilentlyContinue
```

Stop the old server with `Ctrl + C` or terminate the process before restarting.

---

# Known Limitations

- Generation runs locally on CPU and can be slower than hosted GPU inference.
- The default Qwen model is intentionally small for local hardware.
- The current indexed knowledge base focuses on CIS Controls v8.
- The first ingestion requires OCR and local model downloads.
- Production authorization should remove the development ownership header.
- Production HTTPS and deployment configuration are not included.

---

# Business Value

The application demonstrates how enterprise documents can become an interactive and traceable internal knowledge assistant.

Key benefits include:

- Faster access to cybersecurity guidance
- Reduced manual document searching
- Grounded answers from approved source content
- Source traceability
- Local data processing
- Persistent research sessions
- Feedback for future RAG improvement
- Reusable architecture for policies, manuals, standards, and compliance documents