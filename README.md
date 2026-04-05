# ChatbotUI

Full-stack financial chatbot with daily briefings, watchlist management, RAG-based Q&A, and on-demand ticker summarization.

## Architecture

```
ChatbotUI/
├── backend/          # FastAPI BFF + briefing scheduler
│   ├── main.py       # API server (watchlist, briefings, chat, summarize)
│   ├── briefing.py   # Scheduled daily briefing generator
│   ├── rag.py        # RAG pipeline (embed query → vector search → LLM)
│   ├── fetcher.py    # Data extraction from Supabase
│   ├── summarizer.py # Moonshot API for summaries & briefings
│   ├── db.py         # Supabase data access layer
│   └── config.py     # Environment configuration
├── frontend/         # React + Vite
│   └── src/
│       ├── pages/
│       │   ├── BriefingPage.jsx   # View daily briefings
│       │   ├── WatchlistPage.jsx  # Manage tracked tickers + preferences
│       │   └── ChatPage.jsx       # RAG chat + on-demand summarize
│       ├── components/
│       │   └── Sidebar.jsx
│       ├── api.js    # API client
│       └── App.jsx
└── README.md
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Running embedding-service (port 8002)
- Supabase project with schema applied (see `data-pipeline/pipeline/schema.sql`)
- Moonshot API key

## Quick Start

### Backend

```bash
cd ChatbotUI/backend
cp .env.example .env     # fill in credentials
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

### Frontend

```bash
cd ChatbotUI/frontend
npm install
npm run dev              # http://localhost:3000
```

### Daily Briefing (manual test)

```bash
cd ChatbotUI/backend
python briefing.py
```

In production, `briefing.py` runs hourly via GitHub Actions (`.github/workflows/daily-briefing.yml`). It checks each user's timezone and generates a briefing if their local time is 08:00-08:14.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickers` | Available tickers for watchlist |
| GET | `/api/watchlist` | User's watchlist |
| POST | `/api/watchlist` | Add ticker to watchlist |
| DELETE | `/api/watchlist/{ticker}` | Remove ticker |
| GET | `/api/preferences` | User preferences (timezone, briefing toggle) |
| PUT | `/api/preferences` | Update preferences |
| GET | `/api/briefings` | Recent daily briefings |
| GET | `/api/briefings/latest` | Most recent briefing |
| POST | `/api/chat` | RAG-based Q&A |
| POST | `/api/summarize` | On-demand ticker summary |
| GET | `/health` | Health check |

## Integration with Other Services

- **data-pipeline** — Populates Supabase with documents, earnings, price data
- **embedding-service** — Encodes queries for RAG vector search (port 8002)
- **Summarization** — Standalone CLI summarization (ChatbotUI backend reuses the same logic)
- **Supabase** — Central database for all data + user state
