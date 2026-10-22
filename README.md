# CodeMind AI — Hackathon Project (Problem Statement 02)

RAG-powered programming code explainer and debugging assistant. Upload programming PDF/TXT notes, paste code, describe the issue, and get an AI explanation, possible issues, a suggested correction, and source passages retrieved from the uploaded documentation.

## Run locally
1. Install Python 3.10+.
2. Create and activate a virtual environment.
3. Run `pip install -r requirements.txt`.
4. Copy `.env.example` to `.env` and add your `GEMINI_API_KEY`.
5. Run `python manage.py migrate` then `python manage.py runserver`.
6. Open http://127.0.0.1:8000/

## Real RAG workflow
PDF/TXT extraction → text chunking → Gemini embeddings → cosine semantic retrieval → Gemini response grounded in retrieved excerpts → source passages displayed in UI. Vector chunks are in memory and reset when the server restarts.

## Notes
- Uses Gemini embedding model `gemini-embedding-001` and generation model `gemini-2.5-flash` by default; verify model/API availability for your account.
- Scanned PDFs without selectable text are not OCRed.
- Submitted code is never executed.
- If no chunks meet the relevance threshold, the app declines to make a documentation-grounded answer.
- Prototype only: add authentication, rate limiting, persistent vector storage, stricter allowed hosts, upload scanning, and production secret management before public deployment.
- Deploy Django to a Python-compatible host; configure `.env` variables in the host dashboard. Deploying frontend and backend together is easiest for the prototype.
