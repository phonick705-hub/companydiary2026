import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { BLUEPRINT_LIMITS, clampString, createSafeId } from './validation';
import type {
  CareerReport,
  Company,
  DailyLog,
  MonthlyReview,
  Project,
  WorkTag,
} from '../types/worklog';

const DEFAULT_TAGS = [
  { id: 'tag_default_polish', name: '윤문', description: '보고서, 기획서, 커뮤니케이션 문장 다듬기 및 교정' },
  { id: 'tag_default_meeting', name: '회의', description: '팀 미팅, 유관 부서 협업 논의 및 의사결정' },
  { id: 'tag_default_training', name: '교육', description: '직무 교육, 온보딩, 스터디 및 지식 습득' },
  { id: 'tag_default_automation', name: '업무 자동화', description: '반복 업무 스크립트, 템플릿, 워크플로우 효율화' },
  { id: 'tag_default_other', name: '기타', description: '운영 지원 및 기타 일반 업무' },
];

export async function ensureWorkspaceAndDefaultTags(uid: string, displayName: string): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let needsSeed = false;
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        userId: uid,
        displayName: clampString(displayName, 80),
        tagsSeeded: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      needsSeed = true;
    } else if (snap.data()?.tagsSeeded === false) {
      needsSeed = true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  if (needsSeed) {
    try {
      const batch = writeBatch(db);
      for (const tag of DEFAULT_TAGS) {
        const tagRef = doc(db, 'users', uid, 'tags', tag.id);
        batch.set(tagRef, {
          userId: uid,
          name: tag.name,
          description: tag.description,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.update(userRef, {
        tagsSeeded: true,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/tags`);
    }
  }
}

// --- Subscriptions ---

export function subscribeCompanies(uid: string, onData: (items: Company[]) => void): Unsubscribe {
  const path = `users/${uid}/companies`;
  const q = query(collection(db, 'users', uid, 'companies'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Company[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Company, 'id'>),
      }));
      list.sort((a, b) => b.startDate.localeCompare(a.startDate));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeProjects(uid: string, onData: (items: Project[]) => void): Unsubscribe {
  const path = `users/${uid}/projects`;
  const q = query(collection(db, 'users', uid, 'projects'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Project[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Project, 'id'>),
      }));
      list.sort((a, b) => b.startDate.localeCompare(a.startDate));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeWorkTags(uid: string, onData: (items: WorkTag[]) => void): Unsubscribe {
  const path = `users/${uid}/tags`;
  const q = query(collection(db, 'users', uid, 'tags'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: WorkTag[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WorkTag, 'id'>),
      }));
      list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeDailyLogs(uid: string, onData: (items: DailyLog[]) => void): Unsubscribe {
  const path = `users/${uid}/dailyLogs`;
  const q = query(collection(db, 'users', uid, 'dailyLogs'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: DailyLog[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<DailyLog, 'id'>),
      }));
      list.sort((a, b) => b.workDate.localeCompare(a.workDate));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeMonthlyReviews(uid: string, onData: (items: MonthlyReview[]) => void): Unsubscribe {
  const path = `users/${uid}/monthlyReviews`;
  const q = query(collection(db, 'users', uid, 'monthlyReviews'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: MonthlyReview[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MonthlyReview, 'id'>),
      }));
      list.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeCareerReports(uid: string, onData: (items: CareerReport[]) => void): Unsubscribe {
  const path = `users/${uid}/careerReports`;
  const q = query(collection(db, 'users', uid, 'careerReports'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CareerReport[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CareerReport, 'id'>),
      }));
      list.sort((a, b) => {
        const at = a.createdAt?.toMillis() ?? 0;
        const bt = b.createdAt?.toMillis() ?? 0;
        return bt - at;
      });
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

// --- Companies CRUD ---

export type CompanyInput = Omit<Company, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function saveCompany(uid: string, input: CompanyInput, existingId?: string): Promise<string> {
  const id = existingId || createSafeId('comp');
  const path = `users/${uid}/companies/${id}`;
  const payload = {
    companyName: clampString(input.companyName, BLUEPRINT_LIMITS.company.companyName.maxLength),
    startDate: clampString(input.startDate, BLUEPRINT_LIMITS.company.startDate.maxLength),
    endDate: input.isCurrent ? '' : clampString(input.endDate, BLUEPRINT_LIMITS.company.endDate.maxLength),
    isCurrent: Boolean(input.isCurrent),
    department: clampString(input.department, BLUEPRINT_LIMITS.company.department.maxLength),
    responsibilities: clampString(input.responsibilities, BLUEPRINT_LIMITS.company.responsibilities.maxLength),
  };

  try {
    const ref = doc(db, 'users', uid, 'companies', id);
    if (existingId) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCompany(uid: string, companyId: string): Promise<void> {
  const path = `users/${uid}/companies/${companyId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'companies', companyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Projects CRUD ---

export type ProjectInput = Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function saveProject(uid: string, input: ProjectInput, existingId?: string): Promise<string> {
  const id = existingId || createSafeId('proj');
  const path = `users/${uid}/projects/${id}`;

  const cleanMilestones = (input.milestones || [])
    .filter((m) => m.date && m.title.trim())
    .slice(0, BLUEPRINT_LIMITS.project.milestonesMax)
    .map((m) => ({
      id: (m.id || createSafeId('ms')).slice(0, 64),
      date: clampString(m.date, 10),
      title: clampString(m.title, BLUEPRINT_LIMITS.project.milestoneTitleMax),
      note: clampString(m.note || '', BLUEPRINT_LIMITS.project.milestoneNoteMax),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const payload = {
    companyId: clampString(input.companyId || '', BLUEPRINT_LIMITS.project.companyId.maxLength),
    projectName: clampString(input.projectName, BLUEPRINT_LIMITS.project.projectName.maxLength),
    startDate: clampString(input.startDate, BLUEPRINT_LIMITS.project.startDate.maxLength),
    endDate: input.isOngoing ? '' : clampString(input.endDate, BLUEPRINT_LIMITS.project.endDate.maxLength),
    isOngoing: Boolean(input.isOngoing),
    deliverables: clampString(input.deliverables || '', BLUEPRINT_LIMITS.project.deliverables.maxLength),
    learnings: clampString(input.learnings || '', BLUEPRINT_LIMITS.project.learnings.maxLength),
    challenges: clampString(input.challenges || '', BLUEPRINT_LIMITS.project.challenges.maxLength),
    conflicts: clampString(input.conflicts || '', BLUEPRINT_LIMITS.project.conflicts.maxLength),
    solutions: clampString(input.solutions || '', BLUEPRINT_LIMITS.project.solutions.maxLength),
    milestones: cleanMilestones,
  };

  try {
    const ref = doc(db, 'users', uid, 'projects', id);
    if (existingId) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
  const path = `users/${uid}/projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Work Tags CRUD ---

export type WorkTagInput = Omit<WorkTag, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function saveWorkTag(uid: string, input: WorkTagInput, existingId?: string): Promise<string> {
  const id = existingId || createSafeId('tag');
  const path = `users/${uid}/tags/${id}`;
  const payload = {
    name: clampString(input.name, BLUEPRINT_LIMITS.tag.name.maxLength),
    description: clampString(input.description || '', BLUEPRINT_LIMITS.tag.description.maxLength),
  };

  try {
    const ref = doc(db, 'users', uid, 'tags', id);
    if (existingId) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteWorkTag(uid: string, tagId: string): Promise<void> {
  const path = `users/${uid}/tags/${tagId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tags', tagId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Daily Logs CRUD ---

export type DailyLogInput = Omit<DailyLog, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function saveDailyLog(uid: string, input: DailyLogInput, existingId?: string): Promise<string> {
  const id = existingId || createSafeId('log');
  const path = `users/${uid}/dailyLogs/${id}`;

  const cleanTagIds = (input.tagIds || [])
    .map((t) => t.trim())
    .filter((t) => BLUEPRINT_LIMITS.userId.pattern.test(t))
    .slice(0, BLUEPRINT_LIMITS.dailyLog.tagIdsMax);

  const cleanTodos = (input.todos || [])
    .filter((item) => item.text && item.text.trim().length > 0)
    .slice(0, BLUEPRINT_LIMITS.dailyLog.todosMax)
    .map((item) => ({
      id: (item.id || createSafeId('todo')).slice(0, 64),
      text: clampString(item.text, BLUEPRINT_LIMITS.dailyLog.todoTextMax),
      done: Boolean(item.done),
      isCore: Boolean(item.isCore),
    }));

  const payload = {
    workDate: clampString(input.workDate, BLUEPRINT_LIMITS.dailyLog.workDate.maxLength),
    companyId: clampString(input.companyId || '', BLUEPRINT_LIMITS.userId.maxLength),
    projectId: clampString(input.projectId || '', BLUEPRINT_LIMITS.userId.maxLength),
    tagIds: cleanTagIds,
    todos: cleanTodos,
    coreTask: clampString(input.coreTask || '', BLUEPRINT_LIMITS.dailyLog.coreTask.maxLength),
    process: clampString(input.process || '', BLUEPRINT_LIMITS.dailyLog.process.maxLength),
    outcome: clampString(input.outcome || '', BLUEPRINT_LIMITS.dailyLog.outcome.maxLength),
    challenges: clampString(input.challenges || '', BLUEPRINT_LIMITS.dailyLog.challenges.maxLength),
    solutions: clampString(input.solutions || '', BLUEPRINT_LIMITS.dailyLog.solutions.maxLength),
    learnings: clampString(input.learnings || '', BLUEPRINT_LIMITS.dailyLog.learnings.maxLength),
    improvements: clampString(input.improvements || '', BLUEPRINT_LIMITS.dailyLog.improvements.maxLength),
  };

  try {
    const ref = doc(db, 'users', uid, 'dailyLogs', id);
    if (existingId) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteDailyLog(uid: string, logId: string): Promise<void> {
  const path = `users/${uid}/dailyLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'dailyLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Monthly Reviews CRUD ---

export type MonthlyReviewInput = Omit<MonthlyReview, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function saveMonthlyReview(uid: string, input: MonthlyReviewInput, existingId?: string): Promise<string> {
  const id = existingId || `review_${input.monthKey.replace(/[^0-9]/g, '')}`;
  const path = `users/${uid}/monthlyReviews/${id}`;

  const cleanAchievements = (input.keyAchievements || [])
    .map((item) => clampString(item, BLUEPRINT_LIMITS.monthlyReview.keyAchievementMaxLen))
    .filter((item) => item.length > 0)
    .slice(0, BLUEPRINT_LIMITS.monthlyReview.keyAchievementsMax);

  const payload = {
    summary: clampString(input.summary || '', BLUEPRINT_LIMITS.monthlyReview.summary.maxLength),
    newSkills: clampString(input.newSkills || '', BLUEPRINT_LIMITS.monthlyReview.newSkills.maxLength),
    improvements: clampString(input.improvements || '', BLUEPRINT_LIMITS.monthlyReview.improvements.maxLength),
    keyAchievements: cleanAchievements,
    logCount: Math.max(0, Math.min(500, Math.round(Number(input.logCount) || 0))),
  };

  try {
    const ref = doc(db, 'users', uid, 'monthlyReviews', id);
    const existingSnap = await getDoc(ref);
    if (existingId || existingSnap.exists()) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        monthKey: clampString(input.monthKey, 7),
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteMonthlyReview(uid: string, reviewId: string): Promise<void> {
  const path = `users/${uid}/monthlyReviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'monthlyReviews', reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Career Reports CRUD ---

export type CareerReportInput = Omit<CareerReport, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function saveCareerReport(uid: string, input: CareerReportInput, existingId?: string): Promise<string> {
  const id = existingId || createSafeId('career');
  const path = `users/${uid}/careerReports/${id}`;

  const cleanExperiences = (input.dedupedExperiences || [])
    .slice(0, BLUEPRINT_LIMITS.careerReport.dedupedExperiencesMax)
    .map((exp) => ({
      title: clampString(exp.title || '경험', 200) || '경험',
      mergedFromCount: Math.max(1, Math.round(Number(exp.mergedFromCount) || 1)),
      period: clampString(exp.period || '', 80),
      situation: clampString(exp.situation || '', 1500),
      task: clampString(exp.task || '', 1500),
      action: clampString(exp.action || '', 2000),
      result: clampString(exp.result || '', 1500),
      keywords: (exp.keywords || [])
        .map((k) => clampString(k, 60))
        .filter((k) => k.length > 0)
        .slice(0, 15),
    }));

  const cleanResumeSections = (input.resumeSections || [])
    .slice(0, BLUEPRINT_LIMITS.careerReport.resumeSectionsMax)
    .map((sec) => ({
      category: clampString(sec.category || '직무 역량', 100) || '직무 역량',
      headline: clampString(sec.headline || '소제목', 200) || '소제목',
      draft: clampString(sec.draft || '내용 없음', 4000) || '내용 없음',
    }));

  const cleanQuestions = (input.interviewQuestions || [])
    .slice(0, BLUEPRINT_LIMITS.careerReport.interviewQuestionsMax)
    .map((q) => ({
      question: clampString(q.question || '질문', 400) || '질문',
      intent: clampString(q.intent || '', 400),
      answerGuide: clampString(q.answerGuide || '답변 가이드', 3000) || '답변 가이드',
    }));

  const payload = {
    title: clampString(input.title || '커리어 통합 분석 리포트', BLUEPRINT_LIMITS.careerReport.title.maxLength) || '커리어 통합 분석 리포트',
    targetRole: clampString(input.targetRole || '', BLUEPRINT_LIMITS.careerReport.targetRole.maxLength),
    dedupedExperiences: cleanExperiences,
    resumeSections: cleanResumeSections,
    interviewQuestions: cleanQuestions,
    sourceLogCount: Math.max(0, Math.round(Number(input.sourceLogCount) || 0)),
    sourceProjectCount: Math.max(0, Math.round(Number(input.sourceProjectCount) || 0)),
  };

  try {
    const ref = doc(db, 'users', uid, 'careerReports', id);
    if (existingId) {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCareerReport(uid: string, reportId: string): Promise<void> {
  const path = `users/${uid}/careerReports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'careerReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
