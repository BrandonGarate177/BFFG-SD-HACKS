import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapCanvas } from "./components/MapCanvas";
import { FilterPanel } from "./components/FilterPanel";
import { BUDGET, HARD_COST_PER_UNIT, TILES_URL, TIMEFRAME } from "./config";
import type { Filters } from "./lib/filters";
import { buildableUnits } from "./lib/cost";
import { archetypeForUnits } from "../../shared/domain/archetype";

export function MapPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    budgetUsd: BUDGET.default,
    timeframeMonths: TIMEFRAME.defaultMonths,
    hardCostPerUnit: HARD_COST_PER_UNIT,
    archetype: null,
  });
  const [selectedApn, setSelectedApn] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative flex flex-1">
        <MapCanvas
          filters={filters}
          selectedApn={selectedApn}
          onSelect={(parcel) => {
            setSelectedApn(parcel.apn);
            // Insights takes a single rate, so send the one that applies to
            // this parcel rather than the whole table. Keeps ?hardCost= a
            // plain number and the feature boundary a URL.
            const units = buildableUnits(parcel);
            const rate = units == null ? null : filters.hardCostPerUnit[archetypeForUnits(units)];
            // The URL is the interface between features - no cross-feature import.
            navigate(`/parcel/${parcel.apn}${rate == null ? "" : `?hardCost=${rate}`}`);
          }}
        />
        {!TILES_URL && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-[11px] text-accent backdrop-blur">
            Development geometry — real parcel polygons not yet in the repo
          </div>
        )}
      </div>
      <FilterPanel filters={filters} onChange={setFilters} />
    </div>
  );
}
