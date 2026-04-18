/**
 * Utility to track and prevent question repetition within a student session.
 * Stores IDs of seen questions in sessionStorage to persist across page refreshes.
 */
export const RepetitionManager = {
  getSeenIds() {
    try {
      const stored = sessionStorage.getItem('cbt_seen_questions');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  markAsSeen(ids) {
    if (!Array.isArray(ids)) ids = [ids];
    const seen = new Set(this.getSeenIds());
    ids.forEach(id => seen.add(id));
    
    // Keep only the last 2000 IDs to avoid memory bloat
    const updated = Array.from(seen).slice(-2000);
    sessionStorage.setItem('cbt_seen_questions', JSON.stringify(updated));
  },

  clear() {
    sessionStorage.removeItem('cbt_seen_questions');
  }
};
