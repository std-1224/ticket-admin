export interface Attendee {
  id: string
  ticket_id: string | null
  name: string | null
  email: string | null
  created_at: string
}

export interface AttendeeWithPurchaseInfo {
  id: string
  ticket_id: string | null
  name: string | null
  email: string | null
  created_at: string
  tickets_count: number
  payment_status: 'paid' | 'pending' | 'failed'
  purchase_date: string
  check_in_status: 'checked_in' | 'not_checked_in'
  total_price: number
  user_id: string
}

export interface AttendeeStats {
  total_attendees: number
  paid_payments: number
  pending_payments: number
  failed_payments: number
  checked_in: number
  not_checked_in: number
}

export interface AttendeeFilters {
  search?: string
  payment_status?: 'paid' | 'pending' | 'failed' | 'all'
  check_in_status?: 'checked_in' | 'not_checked_in' | 'all'
  event_id?: string
}

export interface AttendeesResponse {
  attendees: AttendeeWithPurchaseInfo[]
  stats: AttendeeStats
  total_count: number
}
