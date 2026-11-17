import React, { useMemo, useState } from 'react';
import { Briefcase, Check, Copy, FileText, Sparkles, Trash2 } from 'lucide-react';
import type {
  CareerReport,
  Company,
  DailyLog,
  MonthlyReview,
  Project,
  WorkTag,
} from '../types/worklog';
import { deleteCareerReport, saveCareerReport } from '../lib/firestoreService';

interface CareerSynthesisViewProps {
  uid: string;
  companies: Company[];
  projects: Project[];
  tags: WorkTag[];
  dailyLogs: DailyLog[];
  monthlyReviews: MonthlyReview[];
  careerReports: CareerReport[];
  loading: boolean;
}

type ResultTab = 'experiences' | 'resume' | 'interview';

export const CareerSynthesisView: React.FC<CareerSynthesisViewProps> = ({
  uid,
  companies,
  projects,
  tags,
  dailyLogs,
  monthlyReviews,
  careerReports,
  loading,
}) => {
  const [targetRole, setTargetRole] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('experiences');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeReport = useMemo(() => {
    if (selectedReportId) {
      return careerReports.find((r) => r.id === selectedReportId) || careerReports[0] || null;
    }
    return careerReports[0] || null;
  }, [careerReports, selectedReportId]);

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

  const tagMap = useMemo(() => {
    const m = new Map<string, WorkTag>();
    tags.forEach((t) => m.set(t.id, t));
    return m;
  }, [tags]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setErrorMsg('클립보드 복사에 실패했습니다.');
    }
  };

  const handleGenerateSynthesis = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const totalCount =
      companies.length + projects.length + dailyLogs.length + monthlyReviews.length;
    if (totalCount === 0) {
      setErrorMsg('분석할 회사, 프로젝트, 업무일지 데이터가 없습니다. 먼저 데이터를 입력해 주세요.');
      return;
    }

    setGenerating(true);
    try {
      const payloadCompanies = companies.map((c) => ({
        companyName: c.companyName,
        startDate: c.startDate,
        endDate: c.endDate,
        isCurrent: c.isCurrent,
        department: c.department,
        responsibilities: c.responsibilities,
      }));

      const payloadProjects = projects.map((p) => ({
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
        milestones: p.milestones || [],
      }));

      const payloadLogs = dailyLogs.map((l) => ({
        workDate: l.workDate,
        companyName: l.companyId ? companyMap.get(l.companyId)?.companyName : undefined,
        projectName: l.projectId ? projectMap.get(l.projectId)?.projectName : undefined,
        tags: l.tagIds.map((id) => tagMap.get(id)?.name).filter(Boolean),
        todos: (l.todos || []).map((t) => ({ text: t.text, done: t.done, isCore: t.isCore })),
        coreTask: l.coreTask,
        process: l.process,
        outcome: l.outcome,
        challenges: l.challenges,
        solutions: l.solutions,
        learnings: l.learnings,
        improvements: l.improvements,
      }));

      const payloadReviews = monthlyReviews.map((r) => ({
        monthKey: r.monthKey,
        summary: r.summary,
        newSkills: r.newSkills,
        improvements: r.improvements,
        keyAchievements: r.keyAchievements,
      }));

      const res = await fetch('/api/ai/career-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: targetRole.trim(),
          companies: payloadCompanies,
          projects: payloadProjects,
          dailyLogs: payloadLogs,
          monthlyReviews: payloadReviews,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '커리어 통합 분석 생성에 실패했습니다.');
      }

      const newReportId = await saveCareerReport(uid, {
        title: data.title || '커리어 통합 분석 리포트',
        targetRole: targetRole.trim(),
        dedupedExperiences: data.dedupedExperiences || [],
        resumeSections: data.resumeSections || [],
        interviewQuestions: data.interviewQuestions || [],
        sourceLogCount: dailyLogs.length,
        sourceProjectCount: projects.length,
      });

      setSelectedReportId(newReportId);
      setActiveTab('experiences');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI 통합 분석 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteCareerReport(uid, id);
      setConfirmDeleteId(null);
      if (selectedReportId === id) {
        setSelectedReportId(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '리포트 삭제 중 오류가 발생했습니다.');
    }
  };

  const buildFullMarkdown = (report: CareerReport): string => {
    const lines: string[] = [
      `# ${report.title}`,
      report.targetRole ? `목표 직무: ${report.targetRole}` : '',
      ``,
      `## 1. 중복 통합 핵심 경험 (STAR)`,
      ...report.dedupedExperiences.flatMap((exp, i) => [
        `### ${i + 1}. ${exp.title} (${exp.period} · 원본 기록 ${exp.mergedFromCount}건 통합)`,
        `- Situation: ${exp.situation}`,
        `- Task: ${exp.task}`,
        `- Action: ${exp.action}`,
        `- Result: ${exp.result}`,
        exp.keywords.length ? `- 키워드: ${exp.keywords.join(', ')}` : '',
        ``,
      ]),
      `## 2. 자기소개서 적용 초안`,
      ...report.resumeSections.flatMap((sec) => [
        `### [${sec.category}] ${sec.headline}`,
        sec.draft,
        ``,
      ]),
      `## 3. 예상 면접 질문 & 답변 가이드`,
      ...report.interviewQuestions.flatMap((q, i) => [
        `### Q${i + 1}. ${q.question}`,
        q.intent ? `- 질문 의도: ${q.intent}` : '',
        `- 답변 가이드: ${q.answerGuide}`,
        ``,
      ]),
    ];
    return lines.filter((line) => line !== undefined).join('\n');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          자기소개서 · 면접 AI 통합 정리
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          지금까지 입력한 회사 경력, 프로젝트, 일일 업무일지, 월간 회고 데이터베이스 전체에서 중복된 업무·경험을 하나로 묶어 통합하고 자기소개서와 면접 대비 자료로 재구성합니다.
        </p>
      </div>

      {/* Database Scope & Generator Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">분석 대상 데이터베이스:</span>
          <span className="font-mono tabular-nums">회사 {companies.length}곳</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">프로젝트 {projects.length}건</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">일일 업무일지 {dailyLogs.length}건</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">월간 회고 {monthlyReviews.length}건</span>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleGenerateSynthesis} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              지원 희망 직무 / 포지션 (선택)
            </label>
            <input
              type="text"
              maxLength={140}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="예: 프로덕트 매니저, 백엔드 엔지니어, 운영 기획자 (비워두면 기록 기반 종합 분석)"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? '중복 통합 및 AI 분석 중...' : '전체 DB 중복 통합 분석 실행'}
          </button>
        </form>
      </section>

      {/* Report Selector (when multiple reports exist) */}
      {careerReports.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {careerReports.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setSelectedReportId(rep.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeReport?.id === rep.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                {rep.title}
              </button>
            ))}
          </div>

          {activeReport && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleCopy('full_md', buildFullMarkdown(activeReport))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'full_md' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'full_md' ? '전체 복사됨' : '전체 마크다운 복사'}
              </button>

              {confirmDeleteId === activeReport.id ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleDeleteReport(activeReport.id)}
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                  >
                    삭제 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(activeReport.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="리포트 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Report Content */}
      {loading ? (
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : !activeReport ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            아직 생성된 커리어 통합 분석 리포트가 없습니다.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            상단의 &lsquo;전체 DB 중복 통합 분석 실행&rsquo; 버튼을 누르면 중복된 일지를 하나로 묶어 자기소개서와 면접 답변 가이드를 생성합니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Report Summary Header + Sub-tabs */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{activeReport.title}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                {activeReport.targetRole && (
                  <>
                    <span>목표 직무: {activeReport.targetRole}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="font-mono tabular-nums">
                  일지 {activeReport.sourceLogCount}건 및 프로젝트 {activeReport.sourceProjectCount}건 기반
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  통합 경험 {activeReport.dedupedExperiences.length}개 추출
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('experiences')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'experiences'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                중복 통합 경험 STAR ({activeReport.dedupedExperiences.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('resume')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'resume'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                자기소개서 초안 ({activeReport.resumeSections.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('interview')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'interview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                예상 면접 질문 ({activeReport.interviewQuestions.length})
              </button>
            </div>
          </div>

          {/* Tab 1: Deduplicated STAR Experiences */}
          {activeTab === 'experiences' && (
            <div className="space-y-4">
              {activeReport.dedupedExperiences.map((exp, idx) => (
                <article
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-slate-900">
                        {String(idx + 1).padStart(2, '0')}. {exp.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {exp.period && (
                          <>
                            <span className="font-mono tabular-nums">{exp.period}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="text-blue-700 font-medium font-mono tabular-nums">
                          유사/중복 기록 {exp.mergedFromCount}건 통합
                        </span>
                        {exp.keywords.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{exp.keywords.join(' / ')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(
                          `exp_${idx}`,
                          `[${exp.title}]\n- Situation: ${exp.situation}\n- Task: ${exp.task}\n- Action: ${exp.action}\n- Result: ${exp.result}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedKey === `exp_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === `exp_${idx}` ? '복사됨' : 'STAR 복사'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Situation (상황)</div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{exp.situation}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Task (과제)</div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{exp.task}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Action (실행)</div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{exp.action}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">Result (결과)</div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{exp.result}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Tab 2: Resume Sections */}
          {activeTab === 'resume' && (
            <div className="space-y-4">
              {activeReport.resumeSections.map((sec, idx) => (
                <article
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-blue-700">{sec.category}</div>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">
                        {sec.headline}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(`res_${idx}`, `[${sec.headline}]\n${sec.draft}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedKey === `res_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === `res_${idx}` ? '복사됨' : '초안 복사'}
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed pt-2 border-t border-slate-100">
                    {sec.draft}
                  </p>
                </article>
              ))}
            </div>
          )}

          {/* Tab 3: Interview Questions */}
          {activeTab === 'interview' && (
            <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded-xl">
              {activeReport.interviewQuestions.map((q, idx) => (
                <article key={idx} className="p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-slate-900">
                        Q{idx + 1}. {q.question}
                      </h3>
                      {q.intent && (
                        <p className="text-xs text-slate-500">질문 의도: {q.intent}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(`iq_${idx}`, `Q. ${q.question}\n\n[답변 가이드]\n${q.answerGuide}`)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedKey === `iq_${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === `iq_${idx}` ? '복사됨' : '질문/답변 복사'}
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 mb-1">
                      실제 데이터 기반 답변 가이드
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {q.answerGuide}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
