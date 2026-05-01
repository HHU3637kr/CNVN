/** 与后端 JSON 对齐的轻量类型 — plan.md §1.2 */

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface TeacherListItem {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  title: string;
  hourly_rate: number;
  currency: string;
  teacher_type: string;
  specialties: string[] | null;
  is_verified: boolean;
  total_lessons: number;
  avg_rating: string;
  total_reviews: number;
}

export interface TeacherProfileOut {
  id: string;
  user_id: string;
  title: string;
  about: string | null;
  video_url: string | null;
  hourly_rate: number;
  currency: string;
  teacher_type: string;
  specialties: string[] | null;
  is_verified: boolean;
  total_lessons: number;
  avg_rating: string;
  total_reviews: number;
  response_rate: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherProfileUpdate {
  title?: string | null;
  about?: string | null;
  video_url?: string | null;
  hourly_rate?: number | null;
  currency?: string | null;
  teacher_type?: string | null;
  specialties?: string[] | null;
}

export interface TeacherTaxProfileOut {
  id: string;
  teacher_id: string;
  tax_scenario: string;
  id_doc_type: string | null;
  id_doc_no: string | null;
  vn_tax_code: string | null;
  vn_residency_days_ytd: number;
  kyc_verified_at: string | null;
  updated_at: string;
}

export interface TeacherTaxProfileUpdate {
  tax_scenario?: "cn_resident" | "vn_passport_in_cn" | "vn_resident" | null;
  id_doc_type?: string | null;
  id_doc_no?: string | null;
  vn_tax_code?: string | null;
  vn_residency_days_ytd?: number | null;
}

export interface LessonListItem {
  id: string;
  teacher_name: string | null;
  student_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  topic: string | null;
  status: LessonStatus;
  price: number;
  ends_at: string;
  can_enter_classroom: boolean;
  classroom_unavailable_reason: string | null;
}

export interface ReviewOut {
  id: string;
  lesson_id: string;
  reviewer_id: string;
  teacher_id: string;
  rating_overall: number;
  rating_teaching: number | null;
  rating_punctuality: number | null;
  rating_communication: number | null;
  content: string | null;
  created_at: string;
  reviewer_name: string | null;
}

export interface ReviewCreate {
  lesson_id: string;
  rating_overall: number;
  rating_teaching?: number | null;
  rating_punctuality?: number | null;
  rating_communication?: number | null;
  content?: string | null;
}

export interface AvailabilityOut {
  id: string;
  teacher_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  created_at: string;
}

export interface AvailabilityCreate {
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
}

export interface AvailabilityUpdate {
  day_of_week?: number | null;
  specific_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_recurring?: boolean | null;
}

export type LessonStatus =
  | "pending_confirmation"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "reviewed"
  | "cancelled"
  | "expired";

export interface LessonCreate {
  teacher_id: string;
  scheduled_at: string;
  duration_minutes: number;
  topic?: string | null;
}

export interface LessonOut {
  id: string;
  student_id: string;
  teacher_id: string;
  scheduled_at: string;
  duration_minutes: number;
  topic: string | null;
  status: LessonStatus;
  price: number;
  cancel_reason: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  ends_at: string;
  can_enter_classroom: boolean;
  classroom_unavailable_reason: string | null;
  created_at: string;
}

export interface UserOut {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  roles: string[];
  active_role: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  roles: string[];
  active_role: string;
}

export interface WalletOut {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface TransactionOut {
  id: string;
  wallet_id: string;
  lesson_id: string | null;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

/** 后端 Decimal 序列化常为 string */
export interface SettlementSnapshotOut {
  id: string;
  lesson_id: string;
  payment_order_id: string;
  tax_scenario: string;
  gross_amount: number;
  commission_rate: string;
  commission_amount: number;
  tax_rate: string;
  vat_amount: number;
  pit_amount: number;
  net_amount: number;
  calculated_at: string;
}

export interface PaymentOrderDetail {
  id: string;
  lesson_id: string;
  student_id: string;
  gross_amount: number;
  channel: string;
  channel_txn_id: string | null;
  status: string;
  held_until: string | null;
  paid_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  settlement_snapshot: SettlementSnapshotOut | null;
}

export interface PayoutOrderOut {
  id: string;
  payment_order_id: string;
  lesson_id: string;
  teacher_id: string;
  settlement_snapshot_id: string;
  gross_amount?: number;
  commission_rate?: string;
  commission_amount?: number;
  vat_amount?: number;
  pit_amount?: number;
  tax_amount?: number;
  net_amount: number;
  tax_scenario?: string | null;
  status: string;
  channel: string;
  channel_txn_id: string | null;
  held_until?: string | null;
  released_at?: string | null;
  paid_at: string | null;
  created_at: string;
}
