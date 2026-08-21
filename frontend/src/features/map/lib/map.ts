import * as maplibregl from "maplibre-gl";
import type { Map, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { DOT_TO_POLYGON_ZOOM, MAP_MAX_BOUNDS, MAP_MIN_ZOOM, MAP_START, TILES_URL } from "../config";
import { generateDevParcels } from "./devParcels";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

export const SRC = "parcels";
export const SRC_DOTS = "parcels-dots-src";
export const L_BASE = "parcels-base";
export const L_MATCH_POLY = "parcels-match-poly";
export const L_MATCH_DOTS = "parcels-match-dots";
export const L_SELECTED = "parcels-selected";

const BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/{fontstack}/{range}.pbf",
  sources: {
    basemap: {
      type: "raster",
      tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#001a4a" } },
    { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 0.38 } },
  ],
};

/** Capacity drives fill colour on both the dot and polygon layers. */
const CAPACITY_COLOR: unknown[] = [
  "interpolate", ["linear"], ["get", "delta_units"],
  1, "#7a6410",
  3, "#b8930c",
  6, "#fdc500",
  12, "#ffd500",
];

export function createMap(container: HTMLDivElement): Map {
  const map = new maplibregl.Map({
    container,
    style: BASE_STYLE,
    center: [MAP_START.lng, MAP_START.lat],
    zoom: MAP_START.zoom,
    minZoom: MAP_MIN_ZOOM,
    maxBounds: MAP_MAX_BOUNDS,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

  map.on("load", () => {
    if (TILES_URL) {
      // Real geometry: one PMTiles archive, served statically over HTTP
      // range requests. promoteId makes apn the feature id so hover and
      // selection can use feature-state instead of re-issuing setFilter.
      map.addSource(SRC, {
        type: "vector",
        url: `pmtiles://${TILES_URL}`,
        promoteId: "apn",
      });
    } else {
      // No parcel geometry exists in the repo yet, so stand in with
      // generated features carrying the identical attribute schema.
      const dev = generateDevParcels();
      map.addSource(SRC, { type: "geojson", data: dev.polygons, promoteId: "apn" });
      map.addSource(SRC_DOTS, { type: "geojson", data: dev.centroids, promoteId: "apn" });
    }

    const vectorLayer = TILES_URL ? { "source-layer": "parcels" } : {};
    const dotsSource = TILES_URL ? SRC : SRC_DOTS;

    // Context: every parcel with any by-right capacity, faint.
    map.addLayer({
      id: L_BASE,
      type: "fill",
      source: SRC,
      ...vectorLayer,
      filter: [">", ["get", "delta_units"], 0] as never,
      paint: { "fill-color": "#00509d", "fill-opacity": 0.34 },
    });

    // Below the zoom where lots are legible, draw centroids instead.
    // Only meaningful for the generated centroid source. Vector tiles hold
    // polygons, and a circle layer renders nothing for polygon geometry.
    if (!TILES_URL) map.addLayer({
      id: L_MATCH_DOTS,
      type: "circle",
      source: dotsSource,
      ...(TILES_URL ? { "source-layer": "parcels" } : {}),
      maxzoom: DOT_TO_POLYGON_ZOOM,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 1.6, 12, 3.4, 13, 5],
        "circle-color": CAPACITY_COLOR as never,
        "circle-opacity": 0.85,
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 0],
        "circle-stroke-color": "#ffd500",
      },
    });

    map.addLayer({
      id: L_MATCH_POLY,
      type: "fill",
      source: SRC,
      ...vectorLayer,
      // No minzoom when real tiles are in play: the fill is the only
      // highlight layer, so gating it would blank the citywide view.
      ...(TILES_URL ? {} : { minzoom: DOT_TO_POLYGON_ZOOM }),
      paint: {
        "fill-color": CAPACITY_COLOR as never,
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.72],
      },
    });

    map.addLayer({
      id: L_SELECTED,
      type: "line",
      source: SRC,
      ...vectorLayer,
      filter: ["==", ["get", "apn"], ""] as never,
      paint: { "line-color": "#ffd500", "line-width": 2.5 },
    });
  });

  return map;
}

/** Both highlight layers share one expression - they are the same data. */
export function applyFilter(map: Map, filter: unknown): void {
  for (const id of [L_MATCH_DOTS, L_MATCH_POLY]) {
    if (map.getLayer(id)) map.setFilter(id, filter as never);
  }
}

export function setSelected(map: Map, apn: string | null): void {
  if (!map.getLayer(L_SELECTED)) return;
  map.setFilter(L_SELECTED, ["==", ["get", "apn"], apn ?? ""] as never);
}

// The dots layer only exists on the generated-geometry path, so hover and
// click handlers must not be bound to it when real tiles are in play.
export const INTERACTIVE_LAYERS = TILES_URL
  ? [L_MATCH_POLY]
  : [L_MATCH_DOTS, L_MATCH_POLY];
