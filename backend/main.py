"""
main.py
FastAPI backend for the ChatbotUI.

Endpoints:
  GET  /api/tickers              — available tickers for watchlist
  GET  /api/watchlist             — user's watchlist
  POST /api/watchlist             — add ticker
  DELETE /api/watchlist/{ticker}  — remove ticker
  GET  /api/preferences           — user preferences (timezone, etc.)
  PUT  /api/preferences           — update preferences
  GET  /api/briefings             — recent daily briefings
  GET  /api/briefings/latest      — most recent briefing
  POST /api/chat/stream           — RAG-based Q&A (SSE streaming)
  POST /api/summarize             — on-demand ticker summary

Run:
  uvicorn main:app --port 8000 --reload
"""

import logging
import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

import db
import rag
from fetcher import fetch_context
from summarizer import generate_summary, generate_briefing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

app = FastAPI(title="QuantAgent Chat API", version="1.0.0")

# CORS: in prod set ALLOWED_ORIGINS="https://your-app.vercel.app,https://your-app-*.vercel.app"
# Defaults to localhost for dev.
_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
_allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=os.getenv("ALLOWED_ORIGIN_REGEX"),  # e.g. https://.*\.vercel\.app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_user_id(x_user_id: str = Header(None)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header required")
    return x_user_id


# ── Tickers ───────────────────────────────────────────────────

@app.get("/api/tickers")
def list_tickers():
    return db.get_tracked_tickers()


# ── Watchlist ─────────────────────────────────────────────────

class WatchlistAdd(BaseModel):
    ticker: str

@app.get("/api/watchlist")
def get_watchlist(x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    return db.get_watchlist(user_id)

@app.post("/api/watchlist")
def add_watchlist(body: WatchlistAdd, x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    ticker = body.ticker.upper().strip()
    db.add_to_watchlist(user_id, ticker)
    return {"status": "ok", "ticker": ticker}

@app.delete("/api/watchlist/{ticker}")
def remove_watchlist(ticker: str, x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    db.remove_from_watchlist(user_id, ticker.upper())
    return {"status": "ok"}


# ── Preferences ───────────────────────────────────────────────

class PreferencesUpdate(BaseModel):
    timezone: str = "America/New_York"
    briefing_enabled: bool = True

@app.get("/api/preferences")
def get_preferences(x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    try:
        prefs = db.get_preferences(user_id)
    except Exception:
        prefs = None
    if not prefs:
        return {"user_id": user_id, "timezone": "America/New_York", "briefing_enabled": True}
    return prefs

@app.put("/api/preferences")
def update_preferences(body: PreferencesUpdate, x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    try:
        db.upsert_preferences(user_id, body.timezone, body.briefing_enabled)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Preferences table not available: {e}")
    return {"status": "ok"}


# ── Briefings ─────────────────────────────────────────────────

@app.get("/api/briefings")
def list_briefings(limit: int = 7, x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    try:
        return db.get_briefings(user_id, limit=limit)
    except Exception:
        return []

@app.get("/api/briefings/latest")
def latest_briefing(x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    try:
        briefing = db.get_latest_briefing(user_id)
    except Exception:
        briefing = None
    if not briefing:
        return {"message": "No briefings yet. Your first briefing will be generated at 8:00 AM your local time."}
    return briefing


@app.get("/api/briefings/by-date")
def briefing_by_date(date: str, x_user_id: str = Header(None)):
    """Fetch a briefing for the given YYYY-MM-DD. 404 if no briefing that day."""
    user_id = _get_user_id(x_user_id)
    try:
        briefing = db.get_briefing_by_date(user_id, date)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    if not briefing:
        raise HTTPException(status_code=404, detail=f"No briefing for {date}")
    return briefing


@app.get("/api/briefings/dates")
def briefing_dates(date_from: str, date_to: str, x_user_id: str = Header(None)):
    """Return list of dates with briefings within [date_from, date_to].

    Frontend uses this to grey out days without data in the date picker.
    Both bounds are inclusive, format YYYY-MM-DD.
    """
    user_id = _get_user_id(x_user_id)
    try:
        dates = db.get_briefing_dates(user_id, date_from, date_to)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"dates": dates}


# ── Refresh Briefing (on-demand) ─────────────────────────────

@app.post("/api/briefings/refresh")
def refresh_briefing(x_user_id: str = Header(None)):
    """Generate a new briefing right now for the user's watchlist."""
    user_id = _get_user_id(x_user_id)
    watchlist = db.get_watchlist(user_id)
    tickers = [w["ticker"] for w in watchlist]
    if not tickers:
        raise HTTPException(status_code=400, detail="Watchlist is empty. Add tickers first.")

    from datetime import datetime, timezone as tz
    local_date = datetime.now(tz.utc).strftime("%Y-%m-%d")

    contexts = []
    for ticker in tickers:
        try:
            ctx = fetch_context(ticker, news_limit=50)
            if ctx.total_chars > 0:
                contexts.append(ctx)
        except Exception as e:
            logging.warning(f"Failed to fetch {ticker}: {e}")

    if not contexts:
        raise HTTPException(status_code=404, detail="No data available for any watchlist ticker.")

    content = generate_briefing(contexts)
    header = f"# Daily Briefing — {local_date}\n\n> Tickers: {', '.join(tickers)}\n\n"
    db.upsert_briefing(user_id, local_date, header + content, tickers)
    return {"status": "ok", "briefing_date": local_date}


# ── RAG Chat ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    ticker: Optional[str] = None             # explicit force-bind (e.g. clarification chip click)
    context_tickers: Optional[list[str]] = None  # watchlist fallback scope
    session_id: Optional[str] = None         # if absent, a new session is created

@app.post("/api/chat/stream")
def chat_stream(body: ChatRequest, x_user_id: str = Header(None)):
    """SSE streaming chat — proxies token stream from question-service, persists messages."""
    user_id = _get_user_id(x_user_id)

    # Resolve or create the session.
    session_id = body.session_id
    is_new_session = False
    if session_id:
        existing = db.get_chat_session(user_id, session_id)
        if not existing:
            # Stale id (another device deleted it) — create a new one.
            session_id = None
    if not session_id:
        session = db.create_chat_session(user_id, title=body.question)
        session_id = session["id"]
        is_new_session = True

    # Persist the user message up-front so it survives a stream error.
    tickers_hint: list[str] = []
    if body.ticker:
        tickers_hint.append(body.ticker.upper())
    try:
        db.append_chat_message(session_id, "user", body.question, tickers=tickers_hint)
    except Exception as e:
        logging.warning(f"Failed to persist user message: {e}")

    import json as _json

    def proxy_and_persist():
        # Announce session id so frontend can update its URL/state.
        yield f"data: {_json.dumps({'type': 'session', 'id': session_id, 'is_new': is_new_session})}\n\n"

        assistant_buf: list[str] = []
        for raw_line in rag.stream_answer_sse(
            body.question,
            ticker=body.ticker,
            context_tickers=body.context_tickers or [],
        ):
            yield raw_line
            # Parse to accumulate assistant tokens (best-effort; never block on error).
            for line in raw_line.splitlines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload == "[DONE]" or payload.startswith("[Error:"):
                    continue
                try:
                    obj = _json.loads(payload)
                except Exception:
                    continue
                if obj.get("type") == "token":
                    assistant_buf.append(obj.get("text") or "")

        # Persist assistant message after the stream completes.
        final_text = "".join(assistant_buf).strip()
        if final_text:
            try:
                db.append_chat_message(session_id, "assistant", final_text, tickers=tickers_hint)
            except Exception as e:
                logging.warning(f"Failed to persist assistant message: {e}")

    return StreamingResponse(
        proxy_and_persist(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Chat sessions ─────────────────────────────────────────────

@app.get("/api/chat/sessions")
def list_sessions(x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    try:
        return db.list_chat_sessions(user_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: str, x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    # Ownership check
    session = db.get_chat_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session": session,
        "messages": db.list_chat_messages(session_id),
    }


@app.delete("/api/chat/sessions/{session_id}")
def remove_session(session_id: str, x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    db.delete_chat_session(user_id, session_id)
    return {"status": "ok"}


@app.delete("/api/chat/sessions")
def remove_all_sessions(x_user_id: str = Header(None)):
    user_id = _get_user_id(x_user_id)
    count = db.delete_all_chat_sessions(user_id)
    return {"status": "ok", "deleted": count}


# ── On-demand Summarization ───────────────────────────────────

class SummarizeRequest(BaseModel):
    ticker: str

@app.post("/api/summarize")
def summarize(body: SummarizeRequest, x_user_id: str = Header(None)):
    _get_user_id(x_user_id)
    ticker = body.ticker.upper().strip()
    ctx = fetch_context(ticker)
    if ctx.total_chars == 0:
        raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
    report = generate_summary(ctx)
    return {"ticker": ticker, "report": report}


# ── Health ────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}
