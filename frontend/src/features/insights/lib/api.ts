import { get, post } from "../../../shared/api/client";
import type {
  ModelMeta,
  ParcelDetail,
  RagChatResponse,
  RagResult,
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

/**
 * POST /parcel-rag — the narrative /parcel-detail used to bundle.
 *
 * Split out because composing it is a Claude call (4-6s) and everything
 * else on the page is an in-memory lookup. Fire it after the detail lands,
 * never before - the page must not wait on this.
 */
export function fetchParcelRag(apn: string): Promise<RagResult> {
  return post<RagResult>("/parcel-rag", { apn });
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
