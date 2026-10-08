import * as maplibreNs from "maplibre-gl";
import type { Map, StyleSpecification } from "maplibre-gl";

/**
 * maplibre-gl v5 exposes two different shapes depending on how it is
 * resolved: requiring it (CJS) yields named exports, while importing the ESM
 * entry yields ONLY a default object. Vite's dev server serves the ESM build
 * and the production bundler applies interop, so a plain namespace import
 * works in one and throws "addProtocol is not a function" in the other —
 * the app builds and deploys fine and the dev server is broken, or vice
 * versa.
 *
 * Reading through `default` when it exists covers both, and survives a bump
 * back to v6, which drops the default entirely.
 */
const maplibregl = ((maplibreNs as unknown as { default?: typeof maplibreNs }).default ??
  maplibreNs) as typeof maplibreNs;
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
/** Parcel layers are inserted under this one, so they never bury place names. */
const BASEMAP_LABELS = "basemap-labels";

/**
 * Basemap: OpenFreeMap's OpenMapTiles vector source, drawn in the app's warm
 * paper palette. Keyless and free for any use, unlike the CARTO raster tiles
 * this replaced, which began answering with "API key required" watermarks.
 * Only water, parks, major roads and place names are drawn - the parcels are
 * the content, the basemap is just orientation.
 */
const BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    basemap: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#f1ece2" } },
    {
      id: "park", type: "fill", source: "basemap", "source-layer": "park",
      paint: { "fill-color": "#e3e3cf", "fill-opacity": 0.8 },
    },
    {
      id: "water", type: "fill", source: "basemap", "source-layer": "water",
      paint: { "fill-color": "#cfd8d5" },
    },
    {
      id: "roads-minor", type: "line", source: "basemap", "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "tertiary"]]],
      paint: {
        "line-color": "#e4ddd0",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 17, 4],
      },
    },
    {
      id: "roads-major", type: "line", source: "basemap", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
      paint: {
        "line-color": "#d8cfbf",
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 13, 1.6, 17, 7],
      },
    },
    {
      id: BASEMAP_LABELS, type: "symbol", source: "basemap", "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "suburb", "neighbourhood"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#6f665a",
        "text-halo-color": "#f4efe6",
        "text-halo-width": 1.4,
      },
    },
  ],
};

/**
 * Capacity drives fill colour on both the dot and polygon layers. One hue,
 * light to dark, and kept apart from the rust accent the UI saves for
 * actions. The lightest step holds 3:1 against the paper ground at the fill
 * opacity below, so even a one-unit parcel stays visible. Exported so the
 * legend draws from the same stops.
 */
export const CAPACITY_STOPS: ReadonlyArray<readonly [units: number, color: string]> = [
  [1, "#a36c1f"],
  [3, "#8a5318"],
  [6, "#6c3913"],
  [12, "#4a240c"],
];

const CAPACITY_COLOR: unknown[] = [
  "interpolate", ["linear"], ["get", "delta_units"],
  ...CAPACITY_STOPS.flat(),
];

/** Parcels with capacity that fall outside the current filter. */
export const CONTEXT_COLOR = "#7d8a96";
export const CONTEXT_OPACITY = 0.3;

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
      paint: { "fill-color": CONTEXT_COLOR, "fill-opacity": CONTEXT_OPACITY },
    }, BASEMAP_LABELS);

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
        "circle-stroke-color": "#1f1a14",
      },
    }, BASEMAP_LABELS);

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
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.85],
      },
    }, BASEMAP_LABELS);

    map.addLayer({
      id: L_SELECTED,
      type: "line",
      source: SRC,
      ...vectorLayer,
      filter: ["==", ["get", "apn"], ""] as never,
      // Blue, so the selection reads against every step of the brown ramp.
      paint: { "line-color": "#1f5f8b", "line-width": 3 },
    }, BASEMAP_LABELS);
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
