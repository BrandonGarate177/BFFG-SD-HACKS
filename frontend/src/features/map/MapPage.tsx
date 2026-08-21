import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapCanvas } from "./components/MapCanvas";
import { FilterPanel } from "./components/FilterPanel";
import { BUDGET, COST_ASSUMPTIONS, TILES_URL, TIMEFRAME } from "./config";
import type { Filters } from "./lib/filters";

export function MapPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    budgetUsd: BUDGET.default,
    timeframeMonths: TIMEFRAME.defaultMonths,
    hardCostPerUnit: COST_ASSUMPTIONS.hardCostPerUnit,
  });
  const [selectedApn, setSelectedApn] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative flex flex-1">
        <MapCanvas
          filters={filters}
          selectedApn={selectedApn}
          onSelect={(apn) => {
            setSelectedApn(apn);
            // The URL is the interface between features - no cross-feature import.
            navigate(`/parcel/${apn}?hardCost=${filters.hardCostPerUnit}`);
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
