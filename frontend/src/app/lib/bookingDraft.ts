export const BOOKING_DRAFT_SESSION_KEY = "cnvn_pending_booking_v1";

export type BookingDraft = {
  teacher_id: string;
  scheduled_at: string;
  duration_minutes: number;
  topic: string;
  return_path: string;
  saved_at: string;
};

type BookingDraftInput = Omit<BookingDraft, "saved_at"> & {
  saved_at?: string;
};

function isBookingDraft(value: unknown): value is BookingDraft {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.teacher_id === "string" &&
    typeof v.scheduled_at === "string" &&
    typeof v.duration_minutes === "number" &&
    typeof v.topic === "string" &&
    typeof v.return_path === "string" &&
    typeof v.saved_at === "string"
  );
}

export function loadBookingDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isBookingDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBookingDraft(draft: BookingDraftInput): BookingDraft {
  const next: BookingDraft = {
    ...draft,
    saved_at: draft.saved_at ?? new Date().toISOString(),
  };
  sessionStorage.setItem(BOOKING_DRAFT_SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearBookingDraft(teacherId?: string): void {
  if (teacherId) {
    const existing = loadBookingDraft();
    if (existing && existing.teacher_id !== teacherId) return;
  }
  sessionStorage.removeItem(BOOKING_DRAFT_SESSION_KEY);
}
