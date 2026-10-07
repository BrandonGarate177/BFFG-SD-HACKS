import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapCanvas } from "./components/MapCanvas";
import { FilterPanel } from "./components/FilterPanel";
import { Legend } from "./components/Legend";
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
    // On phones the panel stacks under a fixed-height map and the page
    // scrolls. Letting both share the viewport squeezed the map to a strip.
    <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
      <div className="relative flex h-[62svh] shrink-0 lg:h-auto lg:flex-1">
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
        <Legend />
        {!TILES_URL && (
          <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full border border-caution-rule bg-caution-bg/95 px-3 py-1 text-[11px] text-caution backdrop-blur">
            Development geometry — real parcel polygons not yet in the repo
          </div>
        )}
      </div>
      <FilterPanel filters={filters} onChange={setFilters} />
    </div>
  );
}
