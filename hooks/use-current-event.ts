/**
 * Hook for managing all events data
 * This replaces the single event selection with all events functionality
 */
export function useCurrentEvent() {
  // Since we're now showing all events, we don't need event selection
  // This hook is kept for backward compatibility but returns null for eventId
  // and false for loading to indicate no specific event is selected

  return {
    eventId: null, // No specific event selected - show all events
    loading: false, // No loading needed since we're not selecting a specific event
    updateEventId: () => {}, // No-op function for backward compatibility
  }
}
