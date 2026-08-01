"""
evals — offline evaluation suites for QuantAgent.

Deliberately kept import-light: `evals.checks` is pure stdlib and must stay
importable without a Moonshot key, a Supabase key, or any service running.
`evals.judge` and `evals.run` import the real `summarizer` module, so they are
NOT re-exported here — importing them eagerly would drag the Supabase client
stack into every consumer of the cheap deterministic checks.

    from evals import checks               # free, no credentials
    from evals.judge import judge_summary  # needs MOONSHOT_API_KEY

Run the suite from the backend/ directory:

    python -m evals.run --suite summarizer --n 3
"""

__all__ = ["checks"]
__version__ = "0.1.0"
