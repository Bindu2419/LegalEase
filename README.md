# LegalEase MVP

AI-Powered Multilingual Legal Document Intelligence and Literacy Platform.

## Run
1. Start MongoDB.
2. `cd server && npm install && cp .env.example .env && npm run dev`
3. `cd client && npm install && npm run dev`
4. Set `OPENAI_API_KEY` in `server/.env` for LLM analysis. Without it, the app uses a simple local fallback so the upload flow still works.

This MVP supports authentication, PDF upload, extraction, document classification, clause extraction, explainable risk assessment, and document Q&A. The vector database/embedding layer is intentionally isolated as the next implementation phase.
