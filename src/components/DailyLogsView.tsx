import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  ClipboardList,
  Edit3,
  Plus,
  Search,
  Square,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { Company, DailyLog, DailyTodoItem, Project, WorkTag } from '../types/worklog';
import { deleteDailyLog, saveDailyLog, saveWorkTag } from '../lib/firestoreService';
import { BLUEPRINT_LIMITS, createSafeId, getTodayDateString } from '../lib/validation';

interface DailyLogsViewProps {
  uid: string;
  companies: Company[];
  projects: Project[];
  tags: WorkTag[];
  dailyLogs: DailyLog[];
  loading: boolean;
  onNavigateToTags: () => void;
}

interface DailyLogFormState {
  workDate: string;
  companyId: string;
  projectId: string;
  tagIds: string[];
  todos: DailyTodoItem[];
  coreTask: string;
  process: string;
  outcome: string;
  challenges: string;
  solutions: string;
  learnings: string;
  improvements: string;
}

function createInitialForm(companies: Company[]): DailyLogFormState {
  const currentCompany = companies.find((c) => c.isCurrent) || companies[0];
  return {
    workDate: getTodayDateString(),
    companyId: currentCompany?.id || '',
    projectId: '',
    tagIds: [],
    todos: [],
    coreTask: '',
    process: '',
    outcome: '',
    challenges: '',
    solutions: '',
    learnings: '',
    improvements: '',
  };
}

export const DailyLogsView: React.FC<DailyLogsViewProps> = ({
  uid,
  companies,
  projects,
  tags,
  dailyLogs,
  loading,
  onNavigateToTags,
}) => {
  const [formOpen, setFormOpen] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DailyLogFormState>(() => createInitialForm(companies));
  const [todoDraft, setTodoDraft] = useState('');
  const [todoDraftIsCore, setTodoDraftIsCore] = useState(false);

  const [quickTagInput, setQuickTagInput] = useState('');
  const [addingQuickTag, setAddingQuickTag] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    dailyLogs.forEach((l) => {
      if (l.workDate.length >= 7) set.add(l.workDate.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dailyLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dailyLogs.filter((log) => {
      if (selectedMonthFilter !== 'all' && !log.workDate.startsWith(selectedMonthFilter)) {
        return false;
      }
      if (selectedTagFilter !== 'all' && !log.tagIds.includes(selectedTagFilter)) {
        return false;
      }
      if (q) {
        const todoTexts = (log.todos || []).map((t) => t.text).join(' ');
        const hay = [
          todoTexts,
          log.coreTask,
          log.process,
          log.outcome,
          log.challenges,
          log.solutions,
          log.learnings,
          log.improvements,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dailyLogs, searchQuery, selectedTagFilter, selectedMonthFilter]);

  const handleAddTodo = () => {
    const text = todoDraft.trim();
    if (!text) return;
    if (form.todos.length >= BLUEPRINT_LIMITS.dailyLog.todosMax) {
      setErrorMsg(`오늘 할 일은 하루 최대 ${BLUEPRINT_LIMITS.dailyLog.todosMax}개까지 추가할 수 있습니다.`);
      return;
    }
    setErrorMsg(null);
    const newItem: DailyTodoItem = {
      id: createSafeId('todo'),
      text: text.slice(0, BLUEPRINT_LIMITS.dailyLog.todoTextMax),
      done: true,
      isCore: todoDraftIsCore,
    };
    setForm((prev) => ({ ...prev, todos: [...prev.todos, newItem] }));
    setTodoDraft('');
    setTodoDraftIsCore(false);
  };

  const handleUpdateTodo = (todoId: string, patch: Partial<DailyTodoItem>) => {
    setForm((prev) => ({
      ...prev,
      todos: prev.todos.map((item) => (item.id === todoId ? { ...item, ...patch } : item)),
    }));
  };

  const handleRemoveTodo = (todoId: string) => {
    setForm((prev) => ({
      ...prev,
      todos: prev.todos.filter((item) => item.id !== todoId),
    }));
  };

  const handleInlineTodoUpdate = async (
    log: DailyLog,
    todoId: string,
    patch: Partial<DailyTodoItem>
  ) => {
    const currentTodos = log.todos || [];
    const updatedTodos = currentTodos.map((item) =>
      item.id === todoId ? { ...item, ...patch } : item
    );
    try {
      await saveDailyLog(
        uid,
        {
          workDate: log.workDate,
          companyId: log.companyId,
          projectId: log.projectId,
          tagIds: log.tagIds,
          todos: updatedTodos,
          coreTask: log.coreTask,
          process: log.process,
          outcome: log.outcome,
          challenges: log.challenges,
          solutions: log.solutions,
          learnings: log.learnings,
          improvements: log.improvements,
        },
        log.id
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '상태 변경 중 오류가 발생했습니다.');
    }
  };

  const toggleTag = (tagId: string) => {
    if (form.tagIds.includes(tagId)) {
      setForm({ ...form, tagIds: form.tagIds.filter((id) => id !== tagId) });
    } else {
      if (form.tagIds.length >= BLUEPRINT_LIMITS.dailyLog.tagIdsMax) {
        setErrorMsg(`해시태그는 일지당 최대 ${BLUEPRINT_LIMITS.dailyLog.tagIdsMax}개까지 선택할 수 있습니다.`);
        return;
      }
      setForm({ ...form, tagIds: [...form.tagIds, tagId] });
    }
  };

  const handleQuickAddTag = async () => {
    const cleaned = quickTagInput.trim().replace(/^#/, '');
    if (!cleaned) return;
    const existing = tags.find((t) => t.name.toLowerCase() === cleaned.toLowerCase());
    if (existing) {
      if (!form.tagIds.includes(existing.id)) {
        setForm({ ...form, tagIds: [...form.tagIds, existing.id] });
      }
      setQuickTagInput('');
      return;
    }

    setAddingQuickTag(true);
    setErrorMsg(null);
    try {
      const newId = await saveWorkTag(uid, { name: cleaned, description: '' });
      setForm((prev) => ({
        ...prev,
        tagIds: prev.tagIds.includes(newId) ? prev.tagIds : [...prev.tagIds, newId],
      }));
      setQuickTagInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '해시태그 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingQuickTag(false);
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(createInitialForm(companies));
    setTodoDraft('');
    setTodoDraftIsCore(false);
    setErrorMsg(null);
    setFormOpen(true);
  };

  const openEditForm = (log: DailyLog) => {
    setEditingId(log.id);
    setForm({
      workDate: log.workDate,
      companyId: log.companyId || '',
      projectId: log.projectId || '',
      tagIds: log.tagIds || [],
      todos: log.todos ? [...log.todos] : [],
      coreTask: log.coreTask || '',
      process: log.process || '',
      outcome: log.outcome || '',
      challenges: log.challenges || '',
      solutions: log.solutions || '',
      learnings: log.learnings || '',
      improvements: log.improvements || '',
    });
    setTodoDraft('');
    setTodoDraftIsCore(false);
    setErrorMsg(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!BLUEPRINT_LIMITS.dailyLog.workDate.pattern.test(form.workDate)) {
      setErrorMsg('날짜를 YYYY-MM-DD 형식으로 선택해 주세요.');
      return;
    }

    // If user typed a todo item without pressing Add, include it cleanly
    let finalTodos = [...form.todos];
    if (todoDraft.trim()) {
      if (finalTodos.length < BLUEPRINT_LIMITS.dailyLog.todosMax) {
        finalTodos.push({
          id: createSafeId('todo'),
          text: todoDraft.trim().slice(0, BLUEPRINT_LIMITS.dailyLog.todoTextMax),
          done: true,
          isCore: todoDraftIsCore,
        });
      }
    }

    if (finalTodos.length === 0 && !form.coreTask.trim() && !form.process.trim() && !form.outcome.trim()) {
      setErrorMsg('오늘 한 일을 To-Do로 1개 이상 입력하거나 업무 내용을 작성해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveDailyLog(
        uid,
        {
          ...form,
          todos: finalTodos,
        },
        editingId || undefined
      );
      setEditingId(null);
      setTodoDraft('');
      setTodoDraftIsCore(false);
      setForm(createInitialForm(companies));
      if (editingId) {
        setFormOpen(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '업무일지 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDailyLog(uid, id);
      setConfirmDeleteId(null);
      if (editingId === id) {
        setEditingId(null);
        setForm(createInitialForm(companies));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  const resolveLogTitle = (log: DailyLog): string => {
    if (log.coreTask && log.coreTask.trim()) return log.coreTask.trim();
    const todos = log.todos || [];
    const coreTodos = todos.filter((t) => t.isCore);
    if (coreTodos.length > 0) {
      return coreTodos.map((t) => t.text).join(' · ');
    }
    if (todos.length > 0) {
      return todos[0].text;
    }
    return `${log.workDate} 업무 기록`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            오늘 한 일 · 일일 업무일지
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            오늘 수행한 모든 업무를 To-Do 목록으로 적고, 필요한 항목만 핵심 업무로 강조할 수 있습니다. 진행 과정·결과와 회고 내용도 함께 기록하세요.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateToTags}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            해시태그 편집
          </button>
          {!formOpen && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              오늘 업무 작성
            </button>
          )}
        </div>
      </div>

      {/* Write / Edit Daily Log Form */}
      {formOpen && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? '업무일지 수정' : '오늘의 업무 기록하기'}
            </h2>
            {dailyLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                접기
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Metadata row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  업무 날짜 <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.workDate}
                  onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  소속 회사 (선택)
                </label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">선택 안 함</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  연관 프로젝트 (선택)
                </label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">선택 안 함</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hashtag Selector + Quick Add */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600">
                  업무 해시태그 선택
                </label>
                <button
                  type="button"
                  onClick={onNavigateToTags}
                  className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                >
                  태그 전체 편집
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => {
                  const active = form.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      #{tag.name}
                    </button>
                  );
                })}

                {/* Inline Quick Add Hashtag */}
                <div className="inline-flex items-center gap-1.5 ml-1">
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.tag.name.maxLength}
                    value={quickTagInput}
                    onChange={(e) => setQuickTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleQuickAddTag();
                      }
                    }}
                    placeholder="+ 새 태그 입력"
                    className="w-32 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                  {quickTagInput.trim() && (
                    <button
                      type="button"
                      disabled={addingQuickTag}
                      onClick={() => void handleQuickAddTag()}
                      className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      추가
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Today's To-Do List Builder + Optional Core Emphasis */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <div>
                  <label className="block text-sm font-medium text-slate-900">
                    오늘 한 일 (To-Do)
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    오늘 처리한 업무를 하나씩 추가하세요. 특별히 중요한 일만 &lsquo;핵심 강조&rsquo;를 선택할 수 있으며, 핵심 업무가 없다면 선택하지 않아도 됩니다.
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                  {form.todos.length}건 (핵심 {form.todos.filter((t) => t.isCore).length}건)
                </span>
              </div>

              {/* Add Todo Row */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.dailyLog.todoTextMax}
                  value={todoDraft}
                  onChange={(e) => setTodoDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTodo();
                    }
                  }}
                  placeholder="예: 주간 보고서 윤문, API 스펙 회의 진행, 데이터 정합성 스크립트 수정"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTodoDraftIsCore(!todoDraftIsCore)}
                    aria-pressed={todoDraftIsCore}
                    className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      todoDraftIsCore
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-white text-slate-600 border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${todoDraftIsCore ? 'fill-blue-700 text-blue-700' : ''}`} />
                    핵심 강조
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTodo}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    할 일 추가
                  </button>
                </div>
              </div>

              {/* Current Form Todo List */}
              {form.todos.length > 0 && (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                  {form.todos.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3.5 py-2.5 flex items-center gap-3 transition-colors ${
                        item.isCore ? 'bg-blue-50/60' : 'bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleUpdateTodo(item.id, { done: !item.done })}
                        className="text-slate-600 hover:text-blue-700 shrink-0 cursor-pointer"
                        aria-label={item.done ? '완료 해제' : '완료 표시'}
                      >
                        {item.done ? (
                          <CheckSquare className="w-4 h-4 text-blue-700" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <input
                        type="text"
                        maxLength={BLUEPRINT_LIMITS.dailyLog.todoTextMax}
                        value={item.text}
                        onChange={(e) => handleUpdateTodo(item.id, { text: e.target.value })}
                        className={`flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-500 rounded focus:outline-none ${
                          item.isCore ? 'font-semibold text-slate-900' : 'text-slate-800'
                        } ${!item.done ? 'text-slate-500' : ''}`}
                      />

                      <button
                        type="button"
                        onClick={() => handleUpdateTodo(item.id, { isCore: !item.isCore })}
                        aria-pressed={item.isCore}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          item.isCore
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        <Star className={`w-3 h-3 ${item.isCore ? 'fill-white' : ''}`} />
                        {item.isCore ? '핵심 업무' : '핵심 강조'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveTodo(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                        aria-label="할 일 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional Summary Title */}
              <div className="pt-1">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  오늘의 업무 한 줄 제목 (선택)
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.dailyLog.coreTask.maxLength}
                  value={form.coreTask}
                  onChange={(e) => setForm({ ...form, coreTask: e.target.value })}
                  placeholder="비워두면 강조한 핵심 업무 또는 첫 번째 To-Do가 대표 제목으로 표시됩니다."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Process & Outcome */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  진행 과정
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.dailyLog.process.maxLength}
                  value={form.process}
                  onChange={(e) => setForm({ ...form, process: e.target.value })}
                  placeholder="어떤 순서와 방법으로 업무를 진행했는지 작성해 주세요."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  결과
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.dailyLog.outcome.maxLength}
                  value={form.outcome}
                  onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                  placeholder="산출물, 완료 상태, 수치 변화 등 오늘의 결과를 기록해 주세요."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* 4 Reflection Fields */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  어려웠던 점
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.dailyLog.challenges.maxLength}
                  value={form.challenges}
                  onChange={(e) => setForm({ ...form, challenges: e.target.value })}
                  placeholder="막혔던 부분이나 예상치 못한 이슈"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  해결 방법
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.dailyLog.solutions.maxLength}
                  value={form.solutions}
                  onChange={(e) => setForm({ ...form, solutions: e.target.value })}
                  placeholder="문제를 돌파한 구체적 방법이나 협업 방식"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  배운 점
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.dailyLog.learnings.maxLength}
                  value={form.learnings}
                  onChange={(e) => setForm({ ...form, learnings: e.target.value })}
                  placeholder="새로 알게 된 지식, 기술, 업무 팁"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  보완할 점
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.dailyLog.improvements.maxLength}
                  value={form.improvements}
                  onChange={(e) => setForm({ ...form, improvements: e.target.value })}
                  placeholder="다음에 개선하거나 챙겨야 할 보완 사항"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setTodoDraft('');
                    setTodoDraftIsCore(false);
                    setForm(createInitialForm(companies));
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  수정 취소
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving ? '저장 중...' : editingId ? '일지 수정 저장' : '오늘의 업무 저장'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter & Search Bar */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="오늘 한 일(To-Do), 과정, 결과, 배운 점 검색..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={selectedMonthFilter}
            onChange={(e) => setSelectedMonthFilter(e.target.value)}
            className="px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">전체 기간 ({dailyLogs.length}건)</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedTagFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedTagFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            전체 태그
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setSelectedTagFilter(tag.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedTagFilter === tag.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              #{tag.name}
            </button>
          ))}
        </div>
      </section>

      {/* Daily Logs Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">작성된 업무일지</h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {filteredLogs.length}건 표시
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {dailyLogs.length === 0
                ? '아직 작성된 일일 업무일지가 없습니다.'
                : '선택한 필터 조건에 맞는 업무일지가 없습니다.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              매일 수행한 일들을 To-Do로 기록해 두면 월말 AI 회고와 자기소개서 생성의 정밀도가 크게 높아집니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded-xl">
            {filteredLogs.map((log) => {
              const company = log.companyId ? companyMap.get(log.companyId) : undefined;
              const project = log.projectId ? projectMap.get(log.projectId) : undefined;
              const resolvedTags = log.tagIds
                .map((id) => tagMap.get(id))
                .filter((t): t is WorkTag => Boolean(t));
              const todos = log.todos || [];
              const doneCount = todos.filter((t) => t.done).length;
              const coreCount = todos.filter((t) => t.isCore).length;

              return (
                <article key={log.id} className="p-6 space-y-4">
                  {/* Lead with Title + Clean Unboxed Metadata */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 leading-snug">
                        {resolveLogTitle(log)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono tabular-nums font-medium text-slate-700">
                          {log.workDate}
                        </span>
                        {todos.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              할 일 {doneCount}/{todos.length} 완료
                              {coreCount > 0 ? ` · 핵심 ${coreCount}건` : ''}
                            </span>
                          </>
                        )}
                        {company && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{company.companyName}</span>
                          </>
                        )}
                        {project && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{project.projectName}</span>
                          </>
                        )}
                        {resolvedTags.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-blue-700 font-medium">
                              {resolvedTags.map((t) => `#${t.name}`).join('  ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(log)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        수정
                      </button>

                      {confirmDeleteId === log.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
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
                          onClick={() => setConfirmDeleteId(log.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 bg-white border border-slate-200 rounded-lg hover:border-red-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive To-Do Checklist */}
                  {todos.length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t border-slate-100">
                      {todos.map((item) => (
                        <li
                          key={item.id}
                          className={`px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                            item.isCore
                              ? 'bg-blue-50/70 border border-blue-200'
                              : 'bg-slate-50/60 border border-transparent'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              void handleInlineTodoUpdate(log, item.id, { done: !item.done })
                            }
                            className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer"
                          >
                            {item.done ? (
                              <CheckSquare className="w-4 h-4 text-blue-700 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`text-sm leading-snug ${
                                item.isCore
                                  ? 'font-semibold text-slate-900'
                                  : 'text-slate-700'
                              } ${!item.done ? 'text-slate-500' : ''}`}
                            >
                              {item.text}
                            </span>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.isCore && (
                              <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">
                                핵심 업무
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                void handleInlineTodoUpdate(log, item.id, { isCore: !item.isCore })
                              }
                              aria-label={item.isCore ? '핵심 강조 해제' : '핵심 업무로 강조'}
                              title={item.isCore ? '핵심 강조 해제' : '핵심 업무로 강조'}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                item.isCore
                                  ? 'text-blue-700 hover:text-blue-900'
                                  : 'text-slate-300 hover:text-slate-600'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${item.isCore ? 'fill-blue-700' : ''}`} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Process & Outcome */}
                  {(log.process || log.outcome) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100">
                      {log.process && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-1">진행 과정</div>
                          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                            {log.process}
                          </p>
                        </div>
                      )}
                      {log.outcome && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-1">결과</div>
                          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                            {log.outcome}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reflection details */}
                  {(log.challenges || log.solutions || log.learnings || log.improvements) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 pt-3 border-t border-slate-100 text-sm">
                      {log.challenges && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">어려웠던 점: </span>
                          <span className="text-slate-700 whitespace-pre-line">{log.challenges}</span>
                        </div>
                      )}
                      {log.solutions && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">해결 방법: </span>
                          <span className="text-slate-700 whitespace-pre-line">{log.solutions}</span>
                        </div>
                      )}
                      {log.learnings && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">배운 점: </span>
                          <span className="text-slate-700 whitespace-pre-line">{log.learnings}</span>
                        </div>
                      )}
                      {log.improvements && (
                        <div>
                          <span className="text-xs font-medium text-slate-500">보완할 점: </span>
                          <span className="text-slate-700 whitespace-pre-line">{log.improvements}</span>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
