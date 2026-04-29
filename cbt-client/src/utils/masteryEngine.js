/**
 * Mastery Engine
 * Logic to transform raw user performance data into actionable insights.
 */

export const MasteryEngine = {
  /**
   * Groups topic mastery data and identifies areas needing improvement.
   * Logic:
   * - Group by subject + topic
   * - Filter: accuracy < 50% AND attempts >= 5
   * - Sort: Weakest first (ascending accuracy)
   */
  getWeakTopics(masteryData) {
    if (!masteryData || !Array.isArray(masteryData)) return [];

    // 1. Process and Filter
    const weakTopics = masteryData
      .map(m => ({
        subject: m.subject || 'General',
        topic: m.topic || 'Unknown Topic',
        accuracy: Math.round(m.mastery_percentage || 0),
        attempts: m.total_attempted || 0
      }))
      .filter(t => t.accuracy < 50 && t.attempts >= 5);

    // 2. Sort by weakest first
    return weakTopics.sort((a, b) => a.accuracy - b.accuracy);
  },

  /**
   * Identifies the user's strongest subject based on average topic mastery.
   */
  getStrongestSubject(subjectMastery) {
    if (!subjectMastery || !Array.isArray(subjectMastery) || subjectMastery.length === 0) return null;
    
    return [...subjectMastery].sort((a, b) => b.average - a.average)[0];
  },

  /**
   * Returns a priority label and color class for a given accuracy.
   */
  getPriorityLabel(accuracy) {
    if (accuracy < 30) return { label: 'CRITICAL', class: 'critical' };
    if (accuracy < 50) return { label: 'NEEDS WORK', class: 'needs-work' };
    return { label: 'STABLE', class: 'stable' };
  },

  /**
   * Generates a mix of topics and mistakes for the Daily Mission.
   * Standard: 10 Topic Questions + 5 Mistake Questions
   */
  generateDailyMission(weakTopics, mistakeIds) {
    // Pick the top 2 weak topics (5 questions each)
    const missionTopics = weakTopics.slice(0, 2).map(t => ({
      topic: t.topic,
      subject: t.subject,
      limit: 5
    }));

    // Pick top 5 recent mistakes
    const missionMistakes = mistakeIds.slice(0, 5);

    return {
      topics: missionTopics,
      mistakes: missionMistakes,
      totalCount: (missionTopics.length * 5) + missionMistakes.length
    };
  }
};
