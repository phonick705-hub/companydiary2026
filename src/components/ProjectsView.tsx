import React, { useMemo, useState } from 'react';
import { Calendar, Check, Edit3, FolderKanban, Plus, Trash2, X } from 'lucide-react';
import type { Company, DailyLog, Project, ProjectMilestone } from '../types/worklog';
import { deleteProject, saveProject } from '../lib/firestoreService';
import { BLUEPRINT_LIMITS, createSafeId, getTodayDateString } from '../lib/validation';

interface ProjectsViewProps {
  uid: string;
  companies: Company[];
  projects: Project[];
  dailyLogs: DailyLog[];
  loading: boolean;
}

interface ProjectFormState {
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
}

const EMPTY_FORM: ProjectFormState = {
  companyId: '',
  projectName: '',
  startDate: '',
  endDate: '',
  isOngoing: true,
  deliverables: '',
  learnings: '',
  challenges: '',
  conflicts: '',
  solutions: '',
  milestones: [],
};

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  uid,
  companies,
  projects,
  dailyLogs,
  loading,
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [newMilestoneDate, setNewMilestoneDate] = useState(getTodayDateString());
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneNote, setNewMilestoneNote] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const companyMap = useMemo(() => {
    const map = new Map<string, Company>();
    companies.forEach((c) => map.set(c.id, c));
    return map;
  }, [companies]);

  const filteredProjects = useMemo(() => {
    if (companyFilter === 'all') return projects;
    return projects.filter((p) => p.companyId === companyFilter);
  }, [projects, companyFilter]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      companyId: companies[0]?.id ?? '',
      startDate: getTodayDateString(),
    });
    setNewMilestoneDate(getTodayDateString());
    setNewMilestoneTitle('');
    setNewMilestoneNote('');
    setErrorMsg(null);
    setFormOpen(true);
  };

  const openEditForm = (project: Project) => {
    setEditingId(project.id);
    setForm({
      companyId: project.companyId || '',
      projectName: project.projectName,
      startDate: project.startDate,
      endDate: project.endDate,
      isOngoing: project.isOngoing,
      deliverables: project.deliverables,
      learnings: project.learnings,
      challenges: project.challenges,
      conflicts: project.conflicts,
      solutions: project.solutions,
      milestones: [...(project.milestones || [])].sort((a, b) => a.date.localeCompare(b.date)),
    });
    setNewMilestoneDate(getTodayDateString());
    setNewMilestoneTitle('');
    setNewMilestoneNote('');
    setErrorMsg(null);
    setFormOpen(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMsg(null);
    setFormOpen(false);
  };

  const handleAddMilestone = () => {
    if (!newMilestoneDate || !newMilestoneTitle.trim()) {
      setErrorMsg('상세 진행 날짜와 진행 단계 제목을 모두 입력해 주세요.');
      return;
    }
    if (form.milestones.length >= BLUEPRINT_LIMITS.project.milestonesMax) {
      setErrorMsg(`상세 진행 날짜는 프로젝트당 최대 ${BLUEPRINT_LIMITS.project.milestonesMax}개까지 등록할 수 있습니다.`);
      return;
    }
    setErrorMsg(null);
    const next: ProjectMilestone[] = [
      ...form.milestones,
      {
        id: createSafeId('ms'),
        date: newMilestoneDate,
        title: newMilestoneTitle.trim().slice(0, BLUEPRINT_LIMITS.project.milestoneTitleMax),
        note: newMilestoneNote.trim().slice(0, BLUEPRINT_LIMITS.project.milestoneNoteMax),
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    setForm({ ...form, milestones: next });
    setNewMilestoneTitle('');
    setNewMilestoneNote('');
  };

  const handleUpdateMilestone = (id: string, patch: Partial<ProjectMilestone>) => {
    const updated = form.milestones
      .map((m) => (m.id === id ? { ...m, ...patch } : m))
      .sort((a, b) => a.date.localeCompare(b.date));
    setForm({ ...form, milestones: updated });
  };

  const handleRemoveMilestone = (id: string) => {
    setForm({
      ...form,
      milestones: form.milestones.filter((m) => m.id !== id),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.projectName.trim()) {
      setErrorMsg('프로젝트명을 입력해 주세요.');
      return;
    }
    if (!BLUEPRINT_LIMITS.project.startDate.pattern.test(form.startDate.trim())) {
      setErrorMsg('진행 시작일을 YYYY-MM-DD 또는 YYYY-MM 형식으로 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveProject(uid, form, editingId || undefined);
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '프로젝트 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(uid, id);
      setConfirmDeleteId(null);
      if (editingId === id) {
        cancelForm();
      }
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
            프로젝트 아카이브
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            프로젝트별 결과물·배운점·어려웠던 점·갈등·해결 방법과 상세 진행 날짜 순서를 체계적으로 관리합니다.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            프로젝트 추가
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {formOpen && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? '프로젝트 내용 및 날짜 수정' : '새 프로젝트 등록'}
            </h2>
            <button
              type="button"
              onClick={cancelForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              닫기
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  프로젝트명 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.project.projectName.maxLength}
                  value={form.projectName}
                  onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                  placeholder="예: 정산 자동화 파이프라인 구축"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  소속 회사 (선택)
                </label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                >
                  <option value="">소속 회사 미지정 / 개인 프로젝트</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  진행 시작일 <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  진행 종료일
                </label>
                <input
                  type="date"
                  disabled={form.isOngoing}
                  value={form.isOngoing ? '' : form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="pb-2">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isOngoing}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isOngoing: e.target.checked,
                        endDate: e.target.checked ? '' : form.endDate,
                      })
                    }
                    className="w-4 h-4 text-blue-700 border-slate-300 rounded focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">현재 진행 중</span>
                </label>
              </div>
            </div>

            {/* 5 Structured Content Fields */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">프로젝트 상세 내용</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    결과물 (Deliverables)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={BLUEPRINT_LIMITS.project.deliverables.maxLength}
                    value={form.deliverables}
                    onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
                    placeholder="완성한 기능, 문서, 수치적 성과 등 구체적인 결과물을 적어주세요."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    배운 점 (Learnings)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={BLUEPRINT_LIMITS.project.learnings.maxLength}
                    value={form.learnings}
                    onChange={(e) => setForm({ ...form, learnings: e.target.value })}
                    placeholder="새롭게 익힌 기술, 프로세스, 협업 인사이트를 정리해 주세요."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    어려웠던 점 (Challenges)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={BLUEPRINT_LIMITS.project.challenges.maxLength}
                    value={form.challenges}
                    onChange={(e) => setForm({ ...form, challenges: e.target.value })}
                    placeholder="기술적 난관, 일정 압박, 데이터 부족 등 어려웠던 지점을 기록해 주세요."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    갈등 / 의견 조율 (Conflicts)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={BLUEPRINT_LIMITS.project.conflicts.maxLength}
                    value={form.conflicts}
                    onChange={(e) => setForm({ ...form, conflicts: e.target.value })}
                    placeholder="유관 부서·팀원과의 의견 충돌이나 우선순위 갈등 상황을 기록해 주세요."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  해결 방법 (Solutions)
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.project.solutions.maxLength}
                  value={form.solutions}
                  onChange={(e) => setForm({ ...form, solutions: e.target.value })}
                  placeholder="어려웠던 점과 갈등을 어떤 접근 방식과 실행으로 해결했는지 작성해 주세요."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Detailed Progress Dates & Chronological Order */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    상세 진행 날짜 및 순서
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    날짜별로 진행 단계를 추가하면 날짜 순으로 자동 정렬되어 프로젝트 흐름을 한눈에 확인할 수 있습니다.
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {form.milestones.length} / {BLUEPRINT_LIMITS.project.milestonesMax}
                </span>
              </div>

              {/* Add milestone bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      진행 날짜
                    </label>
                    <input
                      type="date"
                      value={newMilestoneDate}
                      onChange={(e) => setNewMilestoneDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      단계 / 핵심 활동
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.project.milestoneTitleMax}
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      placeholder="예: 요구사항 정의 및 API 스펙 확정"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      상세 메모 (선택)
                    </label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.project.milestoneNoteMax}
                      value={newMilestoneNote}
                      onChange={(e) => setNewMilestoneNote(e.target.value)}
                      placeholder="해당 날짜의 구체적인 진행 내용이나 결정 사항"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    진행 날짜 추가
                  </button>
                </div>
              </div>

              {/* Editable chronological milestone list */}
              {form.milestones.length > 0 && (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                  {form.milestones.map((ms, index) => (
                    <div key={ms.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-400 w-7 shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="date"
                        value={ms.date}
                        onChange={(e) => handleUpdateMilestone(ms.id, { date: e.target.value })}
                        className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 shrink-0"
                      />
                      <input
                        type="text"
                        value={ms.title}
                        maxLength={BLUEPRINT_LIMITS.project.milestoneTitleMax}
                        onChange={(e) => handleUpdateMilestone(ms.id, { title: e.target.value })}
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <input
                        type="text"
                        value={ms.note}
                        maxLength={BLUEPRINT_LIMITS.project.milestoneNoteMax}
                        onChange={(e) => handleUpdateMilestone(ms.id, { note: e.target.value })}
                        placeholder="메모"
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(ms.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                        aria-label="진행 날짜 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving ? '저장 중...' : editingId ? '프로젝트 수정 저장' : '프로젝트 저장'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter Bar */}
      {companies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCompanyFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              companyFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            전체 ({projects.length})
          </button>
          {companies.map((c) => {
            const count = projects.filter((p) => p.companyId === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCompanyFilter(c.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  companyFilter === c.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                {c.companyName} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            등록된 프로젝트가 없습니다.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            진행한 프로젝트의 결과물, 갈등 및 해결 방법, 상세 진행 날짜를 기록해 두면 월간 회고와 자기소개서 작성에 바로 활용됩니다.
          </p>
          {!formOpen && (
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              첫 프로젝트 등록하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProjects.map((project) => {
            const linkedCompany = project.companyId ? companyMap.get(project.companyId) : undefined;
            const linkedLogsCount = dailyLogs.filter((l) => l.projectId === project.id).length;
            const sortedMilestones = [...(project.milestones || [])].sort((a, b) =>
              a.date.localeCompare(b.date)
            );

            return (
              <article
                key={project.id}
                className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-6"
              >
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {project.projectName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono tabular-nums">
                        {project.startDate} ~ {project.isOngoing ? '진행 중' : project.endDate || '미정'}
                      </span>
                      {linkedCompany && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{linkedCompany.companyName}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className={project.isOngoing ? 'text-blue-700 font-medium' : 'text-slate-600'}>
                        {project.isOngoing ? '진행 중' : '완료'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">연결된 업무일지 {linkedLogsCount}건</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(project)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      수정
                    </button>

                    {confirmDeleteId === project.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(project.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(project.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 bg-white border border-slate-200 rounded-lg hover:border-red-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                {/* Structured 5-part Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  {project.deliverables && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">결과물</div>
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {project.deliverables}
                      </p>
                    </div>
                  )}
                  {project.learnings && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">배운 점</div>
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {project.learnings}
                      </p>
                    </div>
                  )}
                  {project.challenges && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">어려웠던 점</div>
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {project.challenges}
                      </p>
                    </div>
                  )}
                  {project.conflicts && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">갈등</div>
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {project.conflicts}
                      </p>
                    </div>
                  )}
                  {project.solutions && (
                    <div className="md:col-span-2">
                      <div className="text-xs font-semibold text-slate-500 mb-1">해결 방법</div>
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {project.solutions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Chronological Milestones Timeline */}
                {sortedMilestones.length > 0 && (
                  <div className="pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-3">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      상세 진행 날짜 및 순서 ({sortedMilestones.length}단계)
                    </div>
                    <ol className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/60">
                      {sortedMilestones.map((ms, idx) => (
                        <li
                          key={ms.id}
                          className="px-4 py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                        >
                          <div className="flex items-baseline gap-3 shrink-0">
                            <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              {ms.date}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-slate-900">{ms.title}</span>
                            {ms.note && (
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                {ms.note}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
