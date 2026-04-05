# db.py
# Supabase data access layer for the ChatbotUI backend.

import logging
from typing import Optional
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)
_client: Optional[Client] = None

FIELDS_DOCUMENTS = "id, content, ticker, date, source, doc_type, section, title"


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


# ── Watchlist ──────────────────────────────────────────────────

def get_watchlist(user_id: str) -> list[dict]:
    client = get_client()
    return (
        client.table("user_watchlist")
        .select("ticker, added_at")
        .eq("user_id", user_id)
        .order("added_at", desc=True)
        .execute()
        .data
    )


def add_to_watchlist(user_id: str, ticker: str) -> dict:
    client = get_client()
    return (
        client.table("user_watchlist")
        .upsert({"user_id": user_id, "ticker": ticker})
        .execute()
        .data
    )


def remove_from_watchlist(user_id: str, ticker: str) -> None:
    client = get_client()
    client.table("user_watchlist").delete().eq("user_id", user_id).eq("ticker", ticker).execute()


# ── User Preferences ──────────────────────────────────────────

def get_preferences(user_id: str) -> Optional[dict]:
    client = get_client()
    resp = (
        client.table("user_preferences")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def upsert_preferences(user_id: str, timezone: str = "America/New_York", briefing_enabled: bool = True) -> dict:
    client = get_client()
    return (
        client.table("user_preferences")
        .upsert({
            "user_id": user_id,
            "timezone": timezone,
            "briefing_enabled": briefing_enabled,
        })
        .execute()
        .data
    )


# ── Daily Briefings ───────────────────────────────────────────

def get_latest_briefing(user_id: str) -> Optional[dict]:
    client = get_client()
    resp = (
        client.table("daily_briefings")
        .select("*")
        .eq("user_id", user_id)
        .order("briefing_date", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def get_briefings(user_id: str, limit: int = 7) -> list[dict]:
    client = get_client()
    return (
        client.table("daily_briefings")
        .select("briefing_date, tickers, created_at, content")
        .eq("user_id", user_id)
        .order("briefing_date", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def get_users_needing_briefing() -> list[dict]:
    """Fetch users with briefing_enabled=true who have at least one watchlist entry."""
    client = get_client()
    prefs = (
        client.table("user_preferences")
        .select("user_id, timezone")
        .eq("briefing_enabled", True)
        .execute()
        .data
    )
    if not prefs:
        return []

    user_ids = [p["user_id"] for p in prefs]
    watchlist = (
        client.table("user_watchlist")
        .select("user_id, ticker")
        .in_("user_id", user_ids)
        .execute()
        .data
    )

    wl_by_user: dict[str, list[str]] = {}
    for row in watchlist:
        wl_by_user.setdefault(row["user_id"], []).append(row["ticker"])

    results = []
    for p in prefs:
        uid = p["user_id"]
        tickers = wl_by_user.get(uid, [])
        if tickers:
            results.append({
                "user_id": uid,
                "timezone": p["timezone"],
                "tickers": sorted(tickers),
            })
    return results


def briefing_exists(user_id: str, briefing_date: str) -> bool:
    client = get_client()
    resp = (
        client.table("daily_briefings")
        .select("user_id")
        .eq("user_id", user_id)
        .eq("briefing_date", briefing_date)
        .limit(1)
        .execute()
    )
    return len(resp.data) > 0


def upsert_briefing(user_id: str, briefing_date: str, content: str, tickers: list[str]) -> None:
    client = get_client()
    client.table("daily_briefings").upsert({
        "user_id": user_id,
        "briefing_date": briefing_date,
        "content": content,
        "tickers": tickers,
    }).execute()


# ── Tracked Tickers ───────────────────────────────────────────

def get_tracked_tickers() -> list[dict]:
    client = get_client()
    return (
        client.table("tracked_tickers")
        .select("ticker, ticker_type")
        .eq("is_active", True)
        .order("ticker")
        .execute()
        .data
    )


# ── Documents / Earnings / Prices (for RAG & summarization) ──

def get_documents_by_ticker(ticker: str, doc_type: Optional[str] = None, limit: int = 200) -> list[dict]:
    client = get_client()
    query = (
        client.table("documents")
        .select(FIELDS_DOCUMENTS)
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(limit)
    )
    if doc_type:
        query = query.eq("doc_type", doc_type)
    return query.execute().data


def get_earnings(ticker: str, limit: int = 20) -> list[dict]:
    client = get_client()
    return (
        client.table("earnings")
        .select("ticker, quarter, date, eps, revenue, net_income, guidance")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def get_price_snapshots(ticker: str, limit: int = 30) -> list[dict]:
    client = get_client()
    return (
        client.table("price_snapshot")
        .select("ticker, date, close_price, pe_ratio, market_cap")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(limit)
        .execute()
        .data
    )
