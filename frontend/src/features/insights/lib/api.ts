import { post } from "../../../shared/api/client";
import type { ParcelDetail } from "../types";

/** POST /parcel-detail — 404s on an apn outside the 393,755-parcel dataset. */
export function fetchParcelDetail(apn: string): Promise<ParcelDetail> {
  return post<ParcelDetail>("/parcel-detail", { apn });
}
