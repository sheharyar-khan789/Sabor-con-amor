// Internal admin notes about a customer (admin improvements, step 6):
// customerNotes/{uid}. Written and read ONLY by Super Admin server code
// (Admin SDK); never part of any customer page or API, and firestore.rules
// denies every browser read and write.
export const CUSTOMER_NOTES_COLLECTION = "customerNotes";
export const CUSTOMER_NOTES_MAX = 4000;

export interface CustomerNotesRecord {
  uid: string;
  notes: string;
  updatedAt: Date;
  updatedBy: { uid: string };
}
