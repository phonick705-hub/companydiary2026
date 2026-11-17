import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { Company, DailyLog, MonthlyReview, Project, WorkTag } from '../types/worklog';
import { deleteMonthlyReview, saveMonthlyReview } from '../lib/firestoreService';
import { BLUEPRINT_LIMITS, getCurrentMonthKey } from '../lib/validation';

interface MonthlyReviewViewProps {
  uid: string;
  companies: Company[];
  projects: Project[];
  tags: WorkTag[];
  dailyLogs: DailyLog[];
  monthlyReviews: MonthlyReview[];
  loading: boolean;
}

export const MonthlyReviewView: React.FC<MonthlyReviewViewProps> = ({
  uid,
  companies,
  projects,
  tags,
  dailyLogs,
  monthlyReviews,
  loading,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [summary, setSummary] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [improvements, setImprovements] = useState('');
  const [keyAchievements, setKeyAchievements] = useState<string[]>(['', '', '']);
  const [showRawLogs, setShowRawLogs] = useState(false);

  const [generatingAI, setGeneratingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const tagMap = useMemo(() => {
    const m = new Map<string, WorkTag>();
    tags.forEach((t) => m.set(t.id, t));
    return m;
  }, [tags]);

  const companyMap = useMemo(() => {
    const m = new Map<string, Company>();
    companies.forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const monthLogs = useMemo(() => {
    return dailyLogs.filter((l) => l.workDate.startsWith(selectedMonth));
  }, [dailyLogs, selectedMonth]);

  const activeProjectsInMonth = useMemo(() => {
    return projects.filter((p) => {
      const startMonth = p.startDate.slice(0, 7);
      const endMonth = p.isOngoing ? '9999-99' : (p.endDate || '9999-99').slice(0, 7);
      return startMonth <= selectedMonth && selectedMonth <= endMonth;
    });
  }, [projects, selectedMonth]);

  const existingReview = useMemo(() => {
    return monthlyReviews.find((r) => r.monthKey === selectedMonth);
  }, [monthlyReviews, selectedMonth]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([getCurrentMonthKey()]);
    dailyLogs.forEach((l) => {
      if (l.workDate.length >= 7) set.add(l.workDate.slice(0, 7));
    });
    monthlyReviews.forEach((r) => set.add(r.monthKey));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dailyLogs, monthlyReviews]);

  useEffect(() => {
    setErrorMsg(null);
    setStatusMsg(null);
    if (existingReview) {
      setSummary(existingReview.summary);
      setNewSkills(existingReview.newSkills);
      setImprovements(existingReview.improvements);
      setKeyAchievements(
        existingReview.keyAchievements.length > 0 ? existingReview.keyAchievements : ['', '', '']
      );
    } else {
      setSummary('');
      setNewSkills('');
      setImprovements('');
      setKeyAchievements(['', '', '']);
    }
  }, [selectedMonth, existingReview]);

  const handleGenerateAI = async () => {
    setErrorMsg(null);
    setStatusMsg(null);

    if (monthLogs.length === 0 && activeProjectsInMonth.length === 0) {
      setErrorMsg(`${selectedMonth}에 기록된 일일 업무일지나 활성 프로젝트가 없습니다. 먼저 업무일지를 작성해 주세요.`);
      return;
    }

    setGeneratingAI(true);
    try {
      const payloadLogs = monthLogs.map((log) => ({
        workDate: log.workDate,
        companyName: log.companyId ? companyMap.get(log.companyId)?.companyName : undefined,
        projectName: log.projectId ? projectMap.get(log.projectId)?.projectName : undefined,
        tags: log.tagIds.map((id) => tagMap.get(id)?.name).filter(Boolean),
        todos: (log.todos || []).map((t) => ({ text: t.text, done: t.done, isCore: t.isCore })),
        coreTask: log.coreTask,
        process: log.process,
        outcome: log.outcome,
        challenges: log.challenges,
        solutions: log.solutions,
        learnings: log.learnings,
        improvements: log.improvements,
      }));

      const payloadProjects = activeProjectsInMonth.map((p) => ({
        projectName: p.projectName,
        companyName: p.companyId ? companyMap.get(p.companyId)?.companyName : undefined,
        startDate: p.startDate,
        endDate: p.endDate,
        isOngoing: p.isOngoing,
        deliverables: p.deliverables,
        learnings: p.learnings,
        challenges: p.challenges,
        conflicts: p.conflicts,
        solutions: p.solutions,
        milestones: (p.milestones || []).filter((m) => m.date.startsWith(selectedMonth)),
      }));

      const res = await fetch('/api/ai/monthly-retrospective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey: selectedMonth,
          logs: payloadLogs,
          projects: payloadProjects,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI 월간 회고 생성에 실패했습니다.');
      }

      setSummary(data.summary || '');
      setNewSkills(data.newSkills || '');
      setImprovements(data.improvements || '');
      setKeyAchievements(
        Array.isArray(data.keyAchievements) && data.keyAchievements.length > 0
          ? data.keyAchievements
          : ['', '', '']
      );
      setStatusMsg('AI가 이번 달 업무 기록을 분석하여 회고 초안을 정리했습니다. 내용을 확인·수정한 뒤 저장해 주세요.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI 요청 중 오류가 발생했습니다.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    setSaving(true);
    try {
      await saveMonthlyReview(
        uid,
        {
          monthKey: selectedMonth,
          summary,
          newSkills,
          improvements,
          keyAchievements: keyAchievements.filter((k) => k.trim().length > 0),
          logCount: monthLogs.length,
        },
        existingReview?.id
      );
      setStatusMsg(`${selectedMonth} 월간 회고가 저장되었습니다.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '월간 회고 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleAchievementChange = (idx: number, val: string) => {
    const next = [...keyAchievements];
    next[idx] = val;
    setKeyAchievements(next);
  };

  const addAchievementField = () => {
    if (keyAchievements.length < 5) {
      setKeyAchievements([...keyAchievements, '']);
    }
  };

  const removeAchievementField = (idx: number) => {
    if (keyAchievements.length > 1) {
      setKeyAchievements(keyAchievements.filter((_, i) => i !== idx));
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      await deleteMonthlyReview(uid, id);
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            월간 회고
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            매달 작성한 업무일지를 바탕으로 내 업무, 새롭게 습득한 지식/기술, 아쉬웠던 점·개선할 점, 핵심 성과 3~5가지를 AI로 정리하고 보관합니다.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="button"
            onClick={() => void handleGenerateAI()}
            disabled={generatingAI}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {generatingAI ? 'AI 분석 중...' : 'AI 월간 회고 정리'}
          </button>
        </div>
      </div>

      {/* Quick Month Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {availableMonths.map((month) => {
          const count = dailyLogs.filter((l) => l.workDate.startsWith(month)).length;
          const hasReview = monthlyReviews.some((r) => r.monthKey === month);
          return (
            <button
              key={month}
              type="button"
              onClick={() => setSelectedMonth(month)}
              className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedMonth === month
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              {month} ({count}건{hasReview ? ' · 저장됨' : ''})
            </button>
          );
        })}
      </div>

      {/* Month Source Context Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
          <span className="font-semibold font-mono tabular-nums text-slate-900">
            {selectedMonth}
          </span>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span>
            작성된 업무일지 <strong className="font-mono tabular-nums">{monthLogs.length}</strong>건
          </span>
          <span aria-hidden="true">·</span>
          <span>
            진행 프로젝트 <strong className="font-mono tabular-nums">{activeProjectsInMonth.length}</strong>건
          </span>
        </div>

        {monthLogs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRawLogs(!showRawLogs)}
            className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer text-left sm:text-right"
          >
            {showRawLogs ? '이달의 원본 업무일지 접기' : `이달의 원본 업무일지 ${monthLogs.length}건 보기`}
          </button>
        )}
      </div>

      {showRawLogs && monthLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {monthLogs.map((log) => {
            const todos = log.todos || [];
            const coreTodos = todos.filter((t) => t.isCore);
            const headline =
              log.coreTask ||
              (coreTodos.length > 0
                ? coreTodos.map((t) => t.text).join(' / ')
                : todos[0]?.text || '업무 기록');
            return (
              <div key={log.id} className="px-5 py-3.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-mono tabular-nums text-slate-500">{log.workDate}</span>
                  <span className="font-medium text-slate-900">{headline}</span>
                  {todos.length > 0 && (
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      (할 일 {todos.filter((t) => t.done).length}/{todos.length})
                    </span>
                  )}
                  {log.tagIds.length > 0 && (
                    <span className="text-xs text-blue-700">
                      {log.tagIds
                        .map((id) => tagMap.get(id)?.name)
                        .filter(Boolean)
                        .map((name) => `#${name}`)
                        .join(' ')}
                    </span>
                  )}
                </div>
                {log.outcome && (
                  <p className="mt-1 text-xs text-slate-600">결과: {log.outcome}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Feedback messages */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
          {statusMsg}
        </div>
      )}

      {/* Retrospective Editor Form */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            <span className="font-mono tabular-nums">{selectedMonth}</span> 회고 리포트
          </h2>
          {existingReview && (
            <span className="text-xs font-medium text-emerald-700">저장된 회고 편집 중</span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            이번 달 업무 총괄 정리
          </label>
          <textarea
            rows={4}
            maxLength={BLUEPRINT_LIMITS.monthlyReview.summary.maxLength}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="이번 달 수행한 주요 업무의 흐름과 전체적인 요약을 작성하거나 상단의 'AI 월간 회고 정리' 버튼을 눌러 자동 작성하세요."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              새롭게 습득한 지식 혹은 기술
            </label>
            <textarea
              rows={5}
              maxLength={BLUEPRINT_LIMITS.monthlyReview.newSkills.maxLength}
              value={newSkills}
              onChange={(e) => setNewSkills(e.target.value)}
              placeholder="업무를 통해 새롭게 익힌 도구, 프레임워크, 도메인 지식, 협업 노하우"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              아쉬웠던 점 / 개선할 점
            </label>
            <textarea
              rows={5}
              maxLength={BLUEPRINT_LIMITS.monthlyReview.improvements.maxLength}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="일정 관리, 커뮤니케이션, 기술적 완성도 측면에서 아쉬웠던 부분과 개선 방향"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Key Achievements 3-5 items */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              이번 달 핵심 성과 (3~5가지)
            </label>
            {keyAchievements.length < 5 && (
              <button
                type="button"
                onClick={addAchievementField}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                성과 항목 추가
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {keyAchievements.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5">
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-400 w-6 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.monthlyReview.keyAchievementMaxLen}
                  value={item}
                  onChange={(e) => handleAchievementChange(idx, e.target.value)}
                  placeholder={`핵심 성과 ${idx + 1}`}
                  className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {keyAchievements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAchievementField(idx)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                    aria-label="성과 항목 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {saving ? '저장 중...' : existingReview ? '월간 회고 업데이트' : '월간 회고 저장'}
          </button>
        </div>
      </form>

      {/* Saved Monthly Reviews History */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">저장된 월간 회고 이력</h2>
        {loading ? (
          <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : monthlyReviews.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <CalendarDays className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm text-slate-600">아직 저장된 월간 회고가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded-xl">
            {monthlyReviews.map((review) => (
              <div
                key={review.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-baseline gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedMonth(review.monthKey)}
                      className="text-base font-semibold font-mono tabular-nums text-blue-700 hover:underline cursor-pointer"
                    >
                      {review.monthKey}
                    </button>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      기반 일지 {review.logCount}건 · 핵심 성과 {review.keyAchievements.length}개
                    </span>
                  </div>
                  {review.summary && (
                    <p className="text-sm text-slate-600 line-clamp-2">{review.summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(review.monthKey)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    불러오기
                  </button>
                  {confirmDeleteId === review.id ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleDeleteReview(review.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        확인
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(review.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      aria-label="월간 회고 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
