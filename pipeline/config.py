"""
Named, openly-stated constants for the archive pipeline.

Everything here is a deliberate policy choice rather than an incidental
value, so each one is named and commented rather than inlined at its call
site — the same "every assumption is visible" discipline the rest of this
project follows.
"""

from __future__ import annotations

# Load .env for local development, mirroring the TypeScript side's
# `import 'dotenv/config'`. Values already present in the environment always
# win, so CI secrets and test-set variables are never overwritten by a
# stray local file. Optional so the package still imports without it.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - only when running without the dep
    pass

# Identify honestly, every request, with a contactable URL. This crawler
# announces exactly what it is; it never impersonates a browser to get past
# anything. If a provider wants to block it, this is what they block.
USER_AGENT = "TheWodge-Archive/1.0 (+https://thewodge.com/archive; research crawler)"

# Minimum seconds between two requests to the SAME domain. Requests within a
# provider are never parallelised — this is a floor on politeness, not a
# throughput target. Being slow here costs nothing: the archive's value comes
# from collecting every day for years, not from finishing a run quickly.
MIN_DOMAIN_INTERVAL_SECONDS = 5.0

# How long to wait on a single request before giving up and recording a
# failed snapshot row.
REQUEST_TIMEOUT_SECONDS = 30.0

# After this many consecutive failures, a source is surfaced in the admin UI
# as needing attention. Fetching still continues — this is a flag, not a
# circuit breaker, because a source that has genuinely moved needs a human to
# notice rather than the system to quietly stop trying.
FAILURE_ALERT_THRESHOLD = 3

# How stale a source's last check must be before it is due again. The
# scheduler runs far more often than any of these; this table is what
# actually decides what gets fetched on a given run.
FREQUENCY_INTERVAL_HOURS = {
    "daily": 24,
    "weekly": 24 * 7,
    "monthly": 24 * 30,
}

# Where locally-stored snapshot bytes go when no R2 credentials are present
# (dev and tests). Under .data/, which is already gitignored.
LOCAL_OBJECT_STORE_PATH = ".data/archive-objects"

# File extension per source_type, used when building the storage key.
EXTENSION_BY_SOURCE_TYPE = {
    "html": "html",
    "pdf": "pdf",
}
