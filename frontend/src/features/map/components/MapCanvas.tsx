import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, MapGeoJSONFeature } from "maplibre-gl";
import { applyFilter, createMap, INTERACTIVE_LAYERS, setSelected } from "../lib/map";
import { toFilter, type Filters } from "../lib/filters";
import type { TileParcel } from "../types";
import { ParcelPopup } from "./ParcelPopup";

type Props = {
  filters: Filters;
  selectedApn: string | null;
  onSelect: (apn: string) => void;
};

type HoverState = { parcel: TileParcel; x: number; y: number } | null;

export function MapCanvas({ filters, selectedApn, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const hoveredId = useRef<string | number | null>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const [ready, setReady] = useState(false);

  // rAF coalescing: a range slider fires an event per pixel of travel, and
  // each setFilter re-derives render buckets for every loaded tile. One
  // update per frame is the difference between buttery and stuttering.
  const pendingFilter = useRef<Filters | null>(null);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = createMap(containerRef.current);
    mapRef.current = map;

    map.on("load", () => {
      setReady(true);

      for (const layer of INTERACTIVE_LAYERS) {
        map.on("mousemove", layer, (e) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f) return;
          map.getCanvas().style.cursor = "pointer";

          if (hoveredId.current !== null && hoveredId.current !== f.id) {
            map.setFeatureState({ source: f.source, sourceLayer: f.sourceLayer, id: hoveredId.current }, { hover: false });
          }
          hoveredId.current = f.id ?? null;
          if (f.id != null) {
            map.setFeatureState({ source: f.source, sourceLayer: f.sourceLayer, id: f.id }, { hover: true });
          }
          setHover({ parcel: f.properties as unknown as TileParcel, x: e.point.x, y: e.point.y });
        });

        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          setHover(null);
          hoveredId.current = null;
        });

        map.on("click", layer, (e) => {
          const f = e.features?.[0];
          if (f) onSelect((f.properties as unknown as TileParcel).apn);
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Mount once. Filter and selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    pendingFilter.current = filters;
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (pendingFilter.current && mapRef.current) {
        applyFilter(mapRef.current, toFilter(pendingFilter.current));
      }
    });
  }, [filters, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) setSelected(map, selectedApn);
  }, [selectedApn, ready]);

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="absolute inset-0" />
      {hover && <ParcelPopup parcel={hover.parcel} x={hover.x} y={hover.y} hardCostPerUnit={filters.hardCostPerUnit} />}
    </div>
  );
}
