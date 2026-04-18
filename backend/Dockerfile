# Cloud Run-ready Dockerfile for ChatbotUI backend (FastAPI)
FROM python:3.11-slim

WORKDIR /app

# Install deps first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run sets $PORT (default 8080). uvicorn must bind to it.
ENV PORT=8080
EXPOSE 8080

# Use sh -c so $PORT is expanded at runtime
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
