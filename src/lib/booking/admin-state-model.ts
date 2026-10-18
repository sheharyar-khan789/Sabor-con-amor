// Per-admin UI state (admin improvements, step 5): adminState/{uid}.
// Written and read ONLY by Super Admin server code (Admin SDK); firestore.rules
// denies every browser read and write.
export const ADMIN_STATE_COLLECTION = "adminState";

export interface AdminStateRecord {
  uid: string;
  /** Items created up to this time count as seen ("New" marker). Null = never visited. */
  lastSeenAt: Date | null;
  updatedAt: Date;
}
