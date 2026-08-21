import { get, post } from "../../../shared/api/client";
import type {
  ModelMeta,
  ParcelDetail,
  RagChatResponse,
  SearchRequest,
  SearchResponse,
} from "../types";

/** POST /parcel-detail — 404s outside the 393,755-parcel City dataset. */
export function fetchParcelDetail(apn: string): Promise<ParcelDetail> {
  return post<ParcelDetail>("/parcel-detail", { apn });
}

/**
 * POST /search — server-side filter over the predictions frame.
 *
 * The map does NOT use this: it filters client-side against tile attributes.
 * Insights uses it only to find a real apn to inspect, which keeps this
 * feature demoable without the map's geometry.
 */
export function searchParcels(req: SearchRequest): Promise<SearchResponse> {
  return post<SearchResponse>("/search", { limit: 25, ...req });
}

/** GET /model-info — predictions_meta.json verbatim. */
export function fetchModelMeta(): Promise<ModelMeta> {
  return get<ModelMeta>("/model-info");
}

/**
 * POST /rag/chat — one free-text question, one grounded answer.
 *
 * The server composes /parcel-detail's rag_result from this same path, so
 * follow-ups here are continuous with the opening answer.
 */
export function askRag(message: string): Promise<RagChatResponse> {
  return post<RagChatResponse>("/rag/chat", { message });
}
