/**
 * Public surface of the Map feature.
 *
 * Everything else in features/map is private. Nothing outside this folder
 * may deep-import past this barrel, and features/insights may not import
 * from here at all - see eslint.config.js.
 */
export { MapPage } from "./MapPage";
