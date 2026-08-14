"""
Seed data — the provider list, and the sources collection starts from.

Run it:

    python -m pipeline.seed              # providers + initial sources
    python -m pipeline.seed --providers  # providers only, no sources

**Idempotent, and deliberately non-destructive.** Every insert is
`INSERT OR IGNORE`, so re-running adds anything new and leaves everything
existing exactly as it is. Once a source has been edited in the admin UI —
a corrected URL, a tuned `content_selector`, deactivation — re-running this
file must never quietly revert that. Seeding establishes a starting point; it
does not own the data afterwards.

Two things separate the two halves of this file:

- **Providers** are inert metadata. Listing a company here says nothing about
  whether anything is collected from it — it only means the archive knows the
  name. All of them are seeded.
- **Sources** are collection targets. A row here means the crawler will
  visit that URL on a schedule, so this list is deliberately short and grows
  only by explicit decision. Everything in it was confirmed before being
  added, and each provider's terms are a human check that happens before a
  source is added rather than after.
"""

from __future__ import annotations

import argparse
import logging
import sys
from contextlib import closing
from typing import Any, Sequence

from pipeline import db

log = logging.getLogger("pipeline.seed")

# (id, name, provider_type)
#
# Drawn from the source brief's own list of D2C platforms. `provider_type` is
# a starting classification, not a verdict — several of these are genuinely
# more than one thing (an asset manager that also runs a direct platform, a
# bank with an investment arm), and the value here is whichever reading is
# most useful for comparing *platform pricing*. All of it is editable in the
# admin UI.
#
# `website` is deliberately left null. A guessed URL is worse than an absent
# one: it looks authoritative while being unverified. Each gets filled in
# when that provider's sources are actually added and its pages confirmed.
PROVIDERS: tuple[tuple[str, str, str], ...] = (
    ("hargreaves-lansdown", "Hargreaves Lansdown", "platform"),
    ("interactive-investor", "interactive investor", "platform"),
    ("fidelity", "Fidelity Personal Investing", "platform"),
    ("aj-bell", "AJ Bell", "platform"),
    ("vanguard", "Vanguard Investor UK", "platform"),
    ("lloyds-halifax-share-dealing", "Lloyds / Halifax Share Dealing", "platform"),
    ("barclays-smart-investor", "Barclays Smart Investor", "platform"),
    ("hsbc", "HSBC", "bank"),
    ("hsbc-gic", "HSBC Global Investment Centre", "platform"),
    ("santander-investment-hub", "Santander Investment Hub", "platform"),
    ("pensionbee", "PensionBee", "platform"),
    ("charles-stanley-direct", "Charles Stanley Direct", "platform"),
    ("bestinvest", "Bestinvest", "platform"),
    ("freetrade", "Freetrade", "neo_broker"),
    ("true-potential-investor", "True Potential Investor", "robo"),
    ("moneyfarm", "Moneyfarm", "robo"),
    ("moneybox", "Moneybox", "robo"),
    ("trading-212", "Trading 212", "neo_broker"),
    ("investengine", "InvestEngine", "neo_broker"),
    ("ig", "IG", "neo_broker"),
    ("etoro", "eToro", "neo_broker"),
    ("plum", "Plum", "robo"),
    ("wealthify", "Wealthify", "robo"),
    ("dodl", "Dodl by AJ Bell", "platform"),
    ("octopus-money-direct", "Octopus Money Direct", "robo"),
    ("jp-morgan-personal-investing", "J.P. Morgan Personal Investing", "platform"),
    ("natwest-invest", "NatWest Invest", "platform"),
    ("quilter-invest", "Quilter Invest", "platform"),
    ("scottish-widows-share-dealing", "Scottish Widows Share Dealing", "platform"),
    ("cmc-invest", "CMC Invest", "neo_broker"),
    ("saxo", "Saxo", "neo_broker"),
    ("willis-owen", "Willis Owen", "platform"),
    ("monzo", "Monzo", "bank"),
    ("aviva", "Aviva", "life_company"),
    ("lightyear", "Lightyear", "neo_broker"),
    ("xtb", "XTB", "neo_broker"),
    ("columbia-threadneedle", "Columbia Threadneedle", "asset_manager"),
    ("big-exchange", "The Big Exchange", "platform"),
    ("scottish-friendly", "Scottish Friendly", "life_company"),
)

# Website, set only for providers we actually collect from — see the note
# above about not guessing URLs.
PROVIDER_WEBSITES: dict[str, str] = {
    "hargreaves-lansdown": "https://www.hl.co.uk",
    "interactive-investor": "https://www.ii.co.uk",
    "aj-bell": "https://www.ajbell.co.uk",
    "freetrade": "https://freetrade.io",
}

# (id, provider_id, url, source_type, label, is_authoritative, check_frequency)
#
# Source ids are readable slugs rather than uuids. That keeps this file
# idempotent without a lookup, and makes a source identifiable at a glance in
# logs and in the admin UI. Sources added later through the UI can use uuids;
# the column is TEXT and does not care.
#
# `check_frequency` is weekly across the board to start. Pricing pages do not
# change daily, and a week's granularity is ample for a repricing that is
# almost always announced in advance — while a gentler cadence is the right
# way to introduce a new crawler to a site. It can be raised per source once
# the detector is proven quiet against these pages.
#
# Coverage skews to FX and fee caps on purpose: the brief flags these as
# where the largest undisclosed cost differences sit and where the least
# public attention is paid.
INITIAL_SOURCES: tuple[tuple[str, str, str, str, str, int, str], ...] = (
    # Hargreaves Lansdown — tiered percentage with per-account caps.
    (
        "hl-isa-charges",
        "hargreaves-lansdown",
        "https://www.hl.co.uk/investment-services/isa/savings-interest-rates-and-charges",
        "html",
        "ISA charges and interest rates",
        0,
        "weekly",
    ),
    (
        "hl-sipp-charges",
        "hargreaves-lansdown",
        "https://www.hl.co.uk/pensions/sipp/charges-and-interest-rates",
        "html",
        "SIPP charges and interest rates",
        0,
        "weekly",
    ),
    (
        "hl-dealing-charges",
        "hargreaves-lansdown",
        "https://www.hl.co.uk/shares/share-dealing/dealing-charges",
        "html",
        "Share dealing charges",
        0,
        "weekly",
    ),
    # interactive investor — flat monthly fee, the main structural contrast.
    (
        "ii-charges",
        "interactive-investor",
        "https://www.ii.co.uk/our-charges",
        "html",
        "Charges overview",
        0,
        "weekly",
    ),
    (
        "ii-price-plan-comparison",
        "interactive-investor",
        "https://www.ii.co.uk/help/fees-and-charges/our-fees/price-plan-comparison",
        "html",
        "Price plan comparison",
        0,
        "weekly",
    ),
    # AJ Bell — tiered with caps, and one of the few with a published rate
    # card PDF, which is the highest-trust source type there is.
    (
        "ajbell-charges",
        "aj-bell",
        "https://www.ajbell.co.uk/charges",
        "html",
        "Charges, fees and rates",
        0,
        "weekly",
    ),
    (
        "ajbell-sipp-charges",
        "aj-bell",
        "https://www.ajbell.co.uk/pensions/sipp/charges",
        "html",
        "SIPP charges and rates",
        0,
        "weekly",
    ),
    (
        "ajbell-sipp-charges-pdf",
        "aj-bell",
        "https://www.ajbell.co.uk/sites/ajbell/files/SIPP_charges.pdf",
        "pdf",
        "SIPP charges rate card (PDF)",
        1,
        "weekly",
    ),
    # Freetrade — subscription model, and published FX rates that differ by
    # plan, which is exactly the kind of cost the headline never shows.
    (
        "freetrade-compare-plans",
        "freetrade",
        "https://freetrade.io/compare-plans",
        "html",
        "Plan comparison and subscription pricing",
        0,
        "weekly",
    ),
    (
        "freetrade-sipp-charges",
        "freetrade",
        "https://freetrade.io/pension/sipp/sipp-charges-schedule",
        "html",
        "SIPP charges schedule",
        0,
        "weekly",
    ),
    (
        "freetrade-fx-fees",
        "freetrade",
        "https://help.freetrade.io/en/articles/7252900-fx-fees",
        "html",
        "FX fees",
        0,
        "weekly",
    ),
)


def seed_providers(client: Any) -> int:
    added = 0
    for provider_id, name, provider_type in PROVIDERS:
        before = db.query(client, "select 1 from providers where id = ?", [provider_id])
        if before:
            continue
        db.execute(
            client,
            """
            insert or ignore into providers (id, name, provider_type, website)
            values (?, ?, ?, ?)
            """,
            [provider_id, name, provider_type, PROVIDER_WEBSITES.get(provider_id)],
        )
        added += 1
    return added


def seed_sources(client: Any) -> int:
    added = 0
    for (
        source_id,
        provider_id,
        url,
        source_type,
        label,
        is_authoritative,
        check_frequency,
    ) in INITIAL_SOURCES:
        before = db.query(client, "select 1 from sources where id = ?", [source_id])
        if before:
            continue
        db.execute(
            client,
            """
            insert or ignore into sources (
                id, provider_id, url, source_type, label,
                is_authoritative, fetch_method, check_frequency
            ) values (?, ?, ?, ?, ?, ?, 'http', ?)
            """,
            [source_id, provider_id, url, source_type, label, is_authoritative, check_frequency],
        )
        added += 1
    return added


def run(*, client: Any, with_sources: bool = True) -> tuple[int, int]:
    providers_added = seed_providers(client)
    log.info("providers: %s added, %s already present", providers_added, len(PROVIDERS) - providers_added)

    sources_added = 0
    if with_sources:
        sources_added = seed_sources(client)
        log.info(
            "sources: %s added, %s already present",
            sources_added,
            len(INITIAL_SOURCES) - sources_added,
        )
    return providers_added, sources_added


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed providers and initial sources.")
    parser.add_argument(
        "--providers",
        action="store_true",
        help="seed providers only, without adding any collection targets",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="[seed] %(levelname)s %(message)s")

    with closing(db.connect()) as client:
        run(client=client, with_sources=not args.providers)
    return 0


if __name__ == "__main__":
    sys.exit(main())
