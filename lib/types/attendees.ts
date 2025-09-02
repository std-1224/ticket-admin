export interface Attendee {
  id: string
  order_item_id: string | null
  name: string | null
  email: string | null
  created_at: string
}

export interface AttendeeWithPurchaseInfo {
  id: string
  order_item_id: string | null
  name: string | null
  email: string | null
  created_at: string
  tickets_count: number
  payment_status: 'waiting_payment' | 'pending' | 'cancelled' | 'delivered'
  purchase_date: string
  total_price: number
  user_id: string
}

export interface AttendeeStats {
  total_attendees: number
  waiting_payment: number
  pending: number
  cancelled: number
  delivered: number
}

export interface AttendeeFilters {
  search?: string
  payment_status?: 'waiting_payment' | 'pending' | 'cancelled' | 'delivered'
  event_id?: string
}

export interface AttendeesResponse {
  attendees: AttendeeWithPurchaseInfo[]
  stats: AttendeeStats
  total_count: number
}
