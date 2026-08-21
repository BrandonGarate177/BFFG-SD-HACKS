from typing import Optional

import pandas as pd

import parcel_lookup
from models import ParcelMatch

DAYS_PER_MONTH = 30.44  # same day/month convention as the housing-capacity pipeline


def filter_parcels(
    archetype: str,
    budget_usd: float,
    timeframe_months: float,
    community: Optional[str] = None,
    limit: int = 200,
) -> list[ParcelMatch]:
    """Filters the real predictions frame in place. budget_usd is matched against
    permit_fee (a fee floor, not full construction cost — see data/README.md)."""
    df = parcel_lookup.get_dataframe()
    mask = (
        (df["archetype"] == archetype)
        & (df["permit_fee"] <= budget_usd)
        & (df["median_days"] <= timeframe_months * DAYS_PER_MONTH)
    )
    if community:
        mask &= df["situs_community"] == community.strip()

    matches = df[mask].sort_values("permit_fee").head(limit)

    return [
        ParcelMatch(
            apn=row.apn,
            archetype=row.archetype,
            median_days=row.median_days,
            permit_fee_usd=row.permit_fee,
            prob_issued_365d=None if pd.isna(row.prob_issued_365d) else float(row.prob_issued_365d),
        )
        for row in matches.itertuples(index=False)
    ]
