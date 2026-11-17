import type { Timestamp } from 'firebase/firestore';

export type NavTab = 'companies' | 'daily' | 'projects' | 'monthly' | 'career' | 'tags';

export interface UserWorkspace {
  id: string;
  userId: string;
  displayName: string;
  tagsSeeded: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Company {
  id: string;
  userId: string;
  companyName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  department: string;
  responsibilities: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectMilestone {
  id: string;
  date: string;
  title: string;
  note: string;
}

export interface Project {
  id: string;
  userId: string;
  companyId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  isOngoing: boolean;
  deliverables: string;
  learnings: string;
  challenges: string;
  conflicts: string;
  solutions: string;
  milestones: ProjectMilestone[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkTag {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DailyTodoItem {
  id: string;
  text: string;
  done: boolean;
  isCore: boolean;
}

export interface DailyLog {
  id: string;
  userId: string;
  workDate: string;
  companyId: string;
  projectId: string;
  tagIds: string[];
  todos?: DailyTodoItem[];
  coreTask: string;
  process: string;
  outcome: string;
  challenges: string;
  solutions: string;
  learnings: string;
  improvements: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MonthlyReview {
  id: string;
  userId: string;
  monthKey: string;
  summary: string;
  newSkills: string;
  improvements: string;
  keyAchievements: string[];
  logCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DedupedExperience {
  title: string;
  mergedFromCount: number;
  period: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  keywords: string[];
}

export interface ResumeSection {
  category: string;
  headline: string;
  draft: string;
}

export interface InterviewQuestion {
  question: string;
  intent: string;
  answerGuide: string;
}

export interface CareerReport {
  id: string;
  userId: string;
  title: string;
  targetRole: string;
  dedupedExperiences: DedupedExperience[];
  resumeSections: ResumeSection[];
  interviewQuestions: InterviewQuestion[];
  sourceLogCount: number;
  sourceProjectCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
