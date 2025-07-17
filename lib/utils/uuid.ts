/**
 * Utility functions for UUID validation and generation
 */

/**
 * Validates if a string is a valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Generates a sample UUID for testing purposes
 * In production, this should come from your actual events
 */
export function generateSampleEventId(): string {
  return '660e8400-e29b-41d4-a716-446655440001' // Sample event ID from our test data
}

/**
 * Validates and returns a UUID, or null if invalid
 */
export function validateEventId(eventId: string | null): string | null {
  if (!eventId) return null
  if (isValidUUID(eventId)) return eventId
  return null
}
