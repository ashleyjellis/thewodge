"""
Content normalisation ahead of hashing.

Change detection compares hashes of *normalised* content, not raw bytes,
because raw bytes change on every request for reasons that have nothing to do
with pricing — a CSRF token, a cache-busting query string, a rendered
"last updated" stamp, a rotating ad slot. Hashing those directly marks every
source as changed every day and drowns the review queue, which is the failure
mode the source brief warns about most explicitly.

## What gets hashed: text, not markup

The single most consequential decision here. After cleaning, this module
extracts the page's **visible text** and hashes that, rather than hashing the
cleaned markup.

This is a deliberate departure from the brief, which lists attribute-level
cleaning steps (drop `nonce`, `csrf`, `data-testid`, auto-generated `id`,
strip cache-busting query strings) that imply hashing markup. Extracting text
subsumes every one of those steps for free — attributes, URLs and class names
simply are not part of the hashed value — while also absorbing the much larger
category the brief could not enumerate in advance: framework class-name churn,
wrapper `<div>` restructuring, attribute reordering, and every future
templating change a provider's CMS makes without touching a price.

The tradeoff, stated plainly: a change that alters structure without altering
any visible text will not be flagged. For an archive of *published prices*
that is the right trade — prices are text. And it is recoverable rather than
permanent, because the raw capture is always kept: `detect.py` can replay
normalisation over stored snapshots if this judgement ever needs revisiting.

## The governing asymmetry: when in doubt, keep it

A false positive costs one item in the review queue, which a human dismisses
in seconds. A false negative means a repricing is never recorded, and
historical pricing cannot be re-acquired at any price afterwards.

So every removal rule below is written to be *narrow*. Nothing is stripped on
a general suspicion of being dynamic; a rule earns its place by targeting a
region that is both reliably identifiable and reliably not pricing. This is
why, for example, `<time>` elements are left alone entirely — a "last updated
today" stamp is noise, but "effective from <time>1 March 2026</time>" is one
of the most valuable facts on the page.

## Operational note

Whenever these rules change, every source's normalised hash changes with
them, so the first run afterwards reports a change on everything at once. It
is self-correcting — the next run goes quiet — but normalisation should not be
edited casually mid-collection. After changing anything here, prefer
`python -m pipeline.detect` to replay over stored snapshots rather than
letting the live fetcher discover it.
"""

from __future__ import annotations

import hashlib
import re

from bs4 import BeautifulSoup, Comment

# Parsed with Python's own html.parser rather than lxml: no compiled
# dependency to build in CI, and real provider pages are malformed often
# enough that a lenient parser matters more than a fast one.
_PARSER = "html.parser"

_WHITESPACE = re.compile(r"\s+")

# Files whose bytes are already canonical and whose "text" needs a real
# extractor rather than an HTML parser. Detected by magic number rather than
# by the source's declared `source_type`, so a source that is mislabelled — or
# a URL that quietly starts serving a PDF — still normalises correctly.
_PDF_MAGIC = b"%PDF-"

# Elements that never carry visible content. Removed outright.
_NON_CONTENT_TAGS = ("script", "style", "noscript", "template", "svg")

# Regions that are reliably dynamic AND reliably not pricing. Kept narrow on
# purpose — see "the governing asymmetry" above. Each entry names what it is
# for, because an unexplained selector here is impossible to audit later.
DYNAMIC_REGION_SELECTORS = (
    # Cookie/consent banners. The three named ones are the dominant UK
    # consent platforms; their markup is stable and unmistakable.
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    "#CybotCookiebotDialog",
    "#usercentrics-root",
    '[id*="cookie-banner"]',
    '[class*="cookie-banner"]',
    '[id*="cookie-consent"]',
    '[class*="cookie-consent"]',
    # Live chat widgets — injected asynchronously, frequently with a session
    # id or an unread count in the DOM.
    "#intercom-container",
    "#intercom-frame",
    '[id*="livechat"]',
    '[class*="livechat"]',
    '[id*="zendesk"]',
    '[class*="drift-widget"]',
    # Explicitly live regions. An author marking something aria-live is
    # telling us directly that it updates on its own.
    "[aria-live]",
    # "Last updated" / "page generated" stamps. Matched on the label rather
    # than on the <time> element itself, so a genuine effective-date stays.
    '[class*="last-updated"]',
    '[id*="last-updated"]',
    '[class*="page-updated"]',
    '[class*="timestamp"]',
    '[id*="timestamp"]',
    # Market tickers and live quote strips. Anchored with a word boundary via
    # hyphen/underscore conventions rather than a bare "ticker" substring,
    # which would also match "sticker".
    '[class*="market-ticker"]',
    '[class*="price-ticker"]',
    '[class*="live-price"]',
    '[data-live]',
)


def _is_pdf(raw: bytes) -> bool:
    return raw[:5] == _PDF_MAGIC


def _collapse(text: str) -> bytes:
    return _WHITESPACE.sub(" ", text).strip().lower().encode("utf-8")


def normalise_content(
    raw: bytes,
    *,
    content_selector: str | None = None,
) -> bytes:
    """
    Reduces raw captured bytes to the form that gets hashed.

    Order matters and follows the brief:

    1. Narrow to `content_selector`, if the source defines one. This happens
       **first** so that everything after it only ever sees the region that
       was asked for — a selector pointing at a charges table means a
       redesigned header can never register as a pricing change.
    2. Drop non-content elements and HTML comments.
    3. Drop known-dynamic regions.
    4. Extract visible text, collapse whitespace, lowercase.

    PDFs bypass all of this: their bytes are already canonical when served
    statically, and pulling text out of one needs a real PDF extractor, which
    belongs with extraction rather than here. Hashing the bytes is both
    correct and sufficient for detecting that a rate card has been replaced.
    """
    if _is_pdf(raw):
        return raw

    soup = BeautifulSoup(raw, _PARSER)

    if content_selector:
        try:
            selected = soup.select(content_selector)
        except Exception:  # noqa: BLE001
            # `content_selector` is typed by a human in the admin UI, so a
            # malformed one is a matter of when, not if. A typo must degrade
            # to "normalise the whole page" — never to a lost capture.
            selected = []
        if selected:
            # Re-wrap the matched region(s) so later steps operate on a real
            # tree. A selector that matches nothing is deliberately ignored
            # rather than yielding empty content: a page redesign that breaks
            # the selector must not silently normalise every future capture
            # to the same empty hash, which would read as "never changes
            # again" — the worst possible failure for an archive.
            container = BeautifulSoup("<div></div>", _PARSER)
            root = container.div
            assert root is not None
            for element in selected:
                root.append(element.extract())
            soup = container

    for tag_name in _NON_CONTENT_TAGS:
        for element in soup.find_all(tag_name):
            element.decompose()

    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()

    for selector in DYNAMIC_REGION_SELECTORS:
        try:
            for element in soup.select(selector):
                element.decompose()
        except Exception:  # noqa: BLE001
            # A selector that this soupsieve version cannot parse must never
            # take down a capture — skip the rule, keep the content. Erring
            # toward keeping is the whole principle of this module.
            continue

    return _collapse(soup.get_text(separator=" "))


def content_hash(raw: bytes, *, content_selector: str | None = None) -> str:
    """sha256 of the normalised content — what `snapshots.content_sha256` stores."""
    return hashlib.sha256(normalise_content(raw, content_selector=content_selector)).hexdigest()


def raw_hash(raw: bytes) -> str:
    """sha256 of the bytes exactly as fetched — what `snapshots.raw_sha256` stores."""
    return hashlib.sha256(raw).hexdigest()
