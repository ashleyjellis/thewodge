"""
The normalisation ruleset, tested as fixture pairs.

Every test here asks one of two questions:

- **Noise**: two captures that differ only in something irrelevant must
  produce the SAME hash, or the review queue fills with false positives and
  becomes unusable.
- **Signal**: two captures where a published price differs must produce
  DIFFERENT hashes, or a repricing is lost permanently.

The second kind matters more. A false positive costs a reviewer a few
seconds; a false negative loses a fact that cannot be re-acquired at any
price afterwards. The signal tests are the ones that must never be weakened
to make a noise test pass.
"""

from __future__ import annotations

from pipeline.normalise import content_hash, normalise_content, raw_hash


def page(body: str) -> bytes:
    return f"<html><head><title>Charges</title></head><body>{body}</body></html>".encode()


CHARGES_TABLE = """
  <h1>ISA charges</h1>
  <table><tr><td>Platform fee</td><td>0.25% a year</td></tr>
         <tr><td>Fund dealing</td><td>Free</td></tr></table>
"""


class TestNoiseIsAbsorbed:
    def test_whitespace_and_indentation(self):
        a = page("<p>Platform fee 0.25%</p>")
        b = page("<p>Platform    fee\n\n   0.25%</p>")
        assert content_hash(a) == content_hash(b)

    def test_letter_case(self):
        assert content_hash(page("<p>Platform Fee</p>")) == content_hash(page("<p>PLATFORM fee</p>"))

    def test_rotating_csrf_token(self):
        a = page(f'<form><input name="csrf" value="tok-aaa">{CHARGES_TABLE}</form>')
        b = page(f'<form><input name="csrf" value="tok-zzz">{CHARGES_TABLE}</form>')
        assert content_hash(a) == content_hash(b)

    def test_script_nonce_and_inline_script_contents(self):
        a = page(f'<script nonce="n1">var t=111;</script>{CHARGES_TABLE}')
        b = page(f'<script nonce="n2">var t=999;</script>{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_cache_busting_asset_urls(self):
        a = page(f'<link href="/a.css?v=111"><img src="/l.png?v=111">{CHARGES_TABLE}')
        b = page(f'<link href="/a.css?v=999"><img src="/l.png?v=999">{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_cookie_banner_text_changes(self):
        a = page(f'<div id="onetrust-banner-sdk">Accept cookies? id 111</div>{CHARGES_TABLE}')
        b = page(f'<div id="onetrust-banner-sdk">Accept cookies? id 999</div>{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_live_chat_widget_unread_count(self):
        a = page(f'<div id="intercom-container">2 new messages</div>{CHARGES_TABLE}')
        b = page(f'<div id="intercom-container">7 new messages</div>{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_last_updated_stamp(self):
        a = page(f'<span class="last-updated">Updated 3 March 2026</span>{CHARGES_TABLE}')
        b = page(f'<span class="last-updated">Updated 4 March 2026</span>{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_aria_live_region(self):
        a = page(f'<div aria-live="polite">FTSE 8,100</div>{CHARGES_TABLE}')
        b = page(f'<div aria-live="polite">FTSE 8,250</div>{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_market_ticker_strip(self):
        a = page(f'<div class="market-ticker">VOD 72.5p</div>{CHARGES_TABLE}')
        b = page(f'<div class="market-ticker">VOD 74.1p</div>{CHARGES_TABLE}')
        assert content_hash(a) == content_hash(b)

    def test_html_comments(self):
        a = page(f"<!-- build 111 -->{CHARGES_TABLE}")
        b = page(f"<!-- build 999 -->{CHARGES_TABLE}")
        assert content_hash(a) == content_hash(b)

    def test_css_class_churn_and_wrapper_restructuring(self):
        # The category the brief could not enumerate: a CMS or framework
        # upgrade that rewrites markup without touching a single price.
        a = page('<div class="c-card__body--v1"><p>Platform fee 0.25%</p></div>')
        b = page('<section class="Card_body__x9Ff2"><span><p>Platform fee 0.25%</p></span></section>')
        assert content_hash(a) == content_hash(b)

    def test_styling_and_testing_attributes(self):
        a = page('<p data-testid="fee-a" style="color:red">Platform fee 0.25%</p>')
        b = page('<p data-testid="fee-b" style="color:blue">Platform fee 0.25%</p>')
        assert content_hash(a) == content_hash(b)


class TestSignalIsPreserved:
    def test_a_changed_percentage(self):
        a = page("<p>Platform fee 0.25% a year</p>")
        b = page("<p>Platform fee 0.45% a year</p>")
        assert content_hash(a) != content_hash(b)

    def test_a_changed_cash_amount(self):
        a = page("<p>Exit fee £25 per holding</p>")
        b = page("<p>Exit fee £30 per holding</p>")
        assert content_hash(a) != content_hash(b)

    def test_a_changed_fee_cap(self):
        # Caps move real cost in the opposite direction to headline rates —
        # the brief calls these out as among the most valuable to catch.
        a = page("<p>Charges capped at £45 a year</p>")
        b = page("<p>Charges capped at £375 a year</p>")
        assert content_hash(a) != content_hash(b)

    def test_a_changed_tier_boundary(self):
        a = page("<p>0.45% on the first £250,000</p>")
        b = page("<p>0.45% on the first £500,000</p>")
        assert content_hash(a) != content_hash(b)

    def test_free_becoming_chargeable(self):
        a = page("<td>Fund dealing</td><td>Free</td>")
        b = page("<td>Fund dealing</td><td>£1.50</td>")
        assert content_hash(a) != content_hash(b)

    def test_a_whole_charge_row_being_removed(self):
        a = page("<tr><td>Exit fee</td><td>£25</td></tr><tr><td>FX</td><td>1.00%</td></tr>")
        b = page("<tr><td>FX</td><td>1.00%</td></tr>")
        assert content_hash(a) != content_hash(b)

    def test_an_effective_date_in_a_time_element_is_not_stripped(self):
        # <time> is deliberately never removed: "effective from" is one of
        # the most valuable facts on the page, and the bitemporal model
        # depends on it.
        a = page("<p>Effective from <time datetime='2026-03-01'>1 March 2026</time></p>")
        b = page("<p>Effective from <time datetime='2026-09-01'>1 September 2026</time></p>")
        assert content_hash(a) != content_hash(b)


class TestContentSelector:
    PAGE = page(
        '<header><nav>Home Investing About</nav></header>'
        '<main id="charges"><p>Platform fee 0.25%</p></main>'
        '<footer>Copyright 2026</footer>'
    )

    def test_narrows_to_the_selected_region(self):
        narrowed = normalise_content(self.PAGE, content_selector="#charges")
        assert b"platform fee 0.25%" in narrowed
        assert b"home investing about" not in narrowed
        assert b"copyright" not in narrowed

    def test_a_change_outside_the_region_is_ignored(self):
        other = page(
            '<header><nav>Home Investing About Us Careers</nav></header>'
            '<main id="charges"><p>Platform fee 0.25%</p></main>'
            '<footer>Copyright 2027</footer>'
        )
        assert content_hash(self.PAGE, content_selector="#charges") == content_hash(
            other, content_selector="#charges"
        )

    def test_a_change_inside_the_region_still_registers(self):
        other = page(
            '<header><nav>Home Investing About</nav></header>'
            '<main id="charges"><p>Platform fee 0.45%</p></main>'
            '<footer>Copyright 2026</footer>'
        )
        assert content_hash(self.PAGE, content_selector="#charges") != content_hash(
            other, content_selector="#charges"
        )

    def test_a_selector_that_matches_nothing_falls_back_to_the_whole_page(self):
        # A redesign that breaks the selector must not normalise every future
        # capture to the same empty hash — that would read as "this source
        # never changes again", the worst possible silent failure.
        normalised = normalise_content(self.PAGE, content_selector="#does-not-exist")
        assert b"platform fee 0.25%" in normalised

    def test_an_invalid_selector_does_not_lose_the_capture(self):
        normalised = normalise_content(self.PAGE, content_selector="!!not a selector!!")
        assert b"platform fee 0.25%" in normalised


class TestPdf:
    def test_pdf_bytes_are_hashed_as_they_are(self):
        pdf = b"%PDF-1.7\n1 0 obj\n<</Type/Catalog>>\nendobj\n"
        assert normalise_content(pdf) == pdf

    def test_a_changed_rate_card_registers_as_a_change(self):
        a = b"%PDF-1.7\nplatform fee 0.25%\n"
        b = b"%PDF-1.7\nplatform fee 0.45%\n"
        assert content_hash(a) != content_hash(b)

    def test_html_is_not_treated_as_pdf(self):
        assert normalise_content(page("<p>hi</p>")) != page("<p>hi</p>")


class TestHashes:
    def test_raw_and_content_hashes_differ_for_the_same_html(self):
        raw = page("<p>Platform fee 0.25%</p>")
        assert raw_hash(raw) != content_hash(raw)

    def test_hashing_is_stable_across_calls(self):
        raw = page(CHARGES_TABLE)
        assert content_hash(raw) == content_hash(raw)

    def test_malformed_html_still_normalises(self):
        # Real provider pages are malformed often enough that this cannot be
        # allowed to raise.
        broken = b"<html><body><p>Platform fee 0.25%<div><table><tr><td>unclosed"
        assert b"platform fee 0.25%" in normalise_content(broken)
