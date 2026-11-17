// Synchronized with firebase-blueprint.json schema boundaries and patterns

export const BLUEPRINT_LIMITS = {
  userId: { minLength: 1, maxLength: 128, pattern: /^[a-zA-Z0-9_\-]+$/ },
  company: {
    companyName: { minLength: 1, maxLength: 120 },
    startDate: { minLength: 7, maxLength: 10, pattern: /^\d{4}-\d{2}(-\d{2})?$/ },
    endDate: { minLength: 0, maxLength: 10 },
    department: { minLength: 1, maxLength: 120 },
    responsibilities: { minLength: 1, maxLength: 2000 },
  },
  project: {
    companyId: { minLength: 0, maxLength: 128 },
    projectName: { minLength: 1, maxLength: 150 },
    startDate: { minLength: 7, maxLength: 10, pattern: /^\d{4}-\d{2}(-\d{2})?$/ },
    endDate: { minLength: 0, maxLength: 10 },
    deliverables: { minLength: 0, maxLength: 3000 },
    learnings: { minLength: 0, maxLength: 3000 },
    challenges: { minLength: 0, maxLength: 3000 },
    conflicts: { minLength: 0, maxLength: 3000 },
    solutions: { minLength: 0, maxLength: 3000 },
    milestonesMax: 30,
    milestoneTitleMax: 120,
    milestoneNoteMax: 1000,
  },
  tag: {
    name: { minLength: 1, maxLength: 40 },
    description: { minLength: 0, maxLength: 200 },
  },
  dailyLog: {
    workDate: { minLength: 10, maxLength: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ },
    tagIdsMax: 15,
    todosMax: 30,
    todoTextMax: 300,
    coreTask: { minLength: 0, maxLength: 300 },
    process: { minLength: 0, maxLength: 3000 },
    outcome: { minLength: 0, maxLength: 3000 },
    challenges: { minLength: 0, maxLength: 2000 },
    solutions: { minLength: 0, maxLength: 2000 },
    learnings: { minLength: 0, maxLength: 2000 },
    improvements: { minLength: 0, maxLength: 2000 },
  },
  monthlyReview: {
    monthKey: { minLength: 7, maxLength: 7, pattern: /^\d{4}-\d{2}$/ },
    summary: { minLength: 0, maxLength: 4000 },
    newSkills: { minLength: 0, maxLength: 3000 },
    improvements: { minLength: 0, maxLength: 3000 },
    keyAchievementsMax: 10,
    keyAchievementMaxLen: 500,
  },
  careerReport: {
    title: { minLength: 1, maxLength: 150 },
    targetRole: { minLength: 0, maxLength: 150 },
    dedupedExperiencesMax: 20,
    resumeSectionsMax: 10,
    interviewQuestionsMax: 15,
  },
} as const;

export function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function createSafeId(prefix = 'item'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}
