import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

MOONSHOT_API_KEY = os.getenv("MOONSHOT_API_KEY")
MOONSHOT_BASE_URL = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.ai/v1")
MOONSHOT_MODEL = os.getenv("MOONSHOT_MODEL", "kimi-k2.5")

EMBEDDING_SERVICE_URL = os.getenv("EMBEDDING_SERVICE_URL", "http://localhost:8002")
QUESTION_SERVICE_URL = os.getenv("QUESTION_SERVICE_URL", "http://localhost:8003")

MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "380000"))

BRIEFING_WINDOW_MINUTES = int(os.getenv("BRIEFING_WINDOW_MINUTES", "15"))
