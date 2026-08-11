"""
Content normalisation ahead of hashing.

Change detection compares hashes of *normalised* content, not raw bytes,
because raw bytes change on every request for reasons that have nothing to do
with pricing — CSRF tokens, cache-busting query strings, a rendered
"last updated" timestamp, a rotating ad slot. Hashing those directly would
mark every source as changed every day and drown the review queue, which is
the failure mode the source brief warns about most explicitly.

**Scope note — this module is deliberately incomplete at this stage.** What
lives here now is the content-agnostic baseline: decode, collapse whitespace,
lowercase. The HTML-aware ruleset (stripping script/style/comments, dropping
nonce and CSRF attributes, removing known-dynamic selectors, narrowing to a
source's `content_selector`) is the substance of the next phase, and it is
where the real tuning effort goes once there are real captured pages to tune
against. The function signature and its call site in fetch.py are stable, so
that work replaces the internals here without touching the fetcher.

One operational consequence worth stating plainly rather than discovering
later: whenever these rules change, every source's normalised hash changes
with them, so the next run after any such change will report a change on
every source at once. That is expected and self-correcting — the run after
it goes quiet again — but it means normalisation should not be edited
casually mid-collection, and a rules change is a good moment to re-run
detection over stored snapshots rather than trusting the live diff.
"""

from __future__ import annotations

import hashlib
import re

_WHITESPACE = re.compile(rb"\s+")


def normalise_content(raw: bytes, *, content_selector: str | None = None) -> bytes:
    """
    Reduces raw captured bytes to the form that gets hashed for change
    detection.

    `content_selector` is accepted now and ignored until the HTML-aware
    ruleset lands, so that sources can already be configured with one and the
    fetcher never needs to change.
    """
    collapsed = _WHITESPACE.sub(b" ", raw).strip()
    return collapsed.lower()


def content_hash(raw: bytes, *, content_selector: str | None = None) -> str:
    """sha256 of the normalised content — what `snapshots.content_sha256` stores."""
    return hashlib.sha256(normalise_content(raw, content_selector=content_selector)).hexdigest()


def raw_hash(raw: bytes) -> str:
    """sha256 of the bytes exactly as fetched — what `snapshots.raw_sha256` stores."""
    return hashlib.sha256(raw).hexdigest()
