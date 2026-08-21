/**
 * Public surface of the Insights feature (ML predictions + RAG assistant).
 *
 * Everything else in features/insights is private. features/map may not
 * import from here — the two features communicate only through the router.
 */
export { InsightsPage } from "./InsightsPage";
