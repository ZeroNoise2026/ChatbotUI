# Cloud Run-ready Dockerfile for ChatbotUI backend (FastAPI)
FROM python:3.11-slim

WORKDIR /app

# Install deps first for better layer caching.
# NOTE: this also pulls the shared `skills` package straight from its own git
# repo (see requirements.txt). It deliberately is not COPY'd — the build
# context is backend/, which cannot reach the sibling Skills repo.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run sets $PORT (default 8080). uvicorn must bind to it.
ENV PORT=8080
EXPOSE 8080

# Use sh -c so $PORT is expanded at runtime
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
