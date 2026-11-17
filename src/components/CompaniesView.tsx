import React, { useState } from 'react';
import { Building2, Edit3, Plus, Trash2, Check, X } from 'lucide-react';
import type { Company, DailyLog, Project } from '../types/worklog';
import { deleteCompany, saveCompany } from '../lib/firestoreService';
import { BLUEPRINT_LIMITS } from '../lib/validation';

interface CompaniesViewProps {
  uid: string;
  companies: Company[];
  projects: Project[];
  dailyLogs: DailyLog[];
  loading: boolean;
}

interface CompanyFormState {
  companyName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  department: string;
  responsibilities: string;
}

const EMPTY_FORM: CompanyFormState = {
  companyName: '',
  startDate: '',
  endDate: '',
  isCurrent: true,
  department: '',
  responsibilities: '',
};

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  uid,
  companies,
  projects,
  dailyLogs,
  loading,
}) => {
  const [formOpen, setFormOpen] = useState<boolean>(companies.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMsg(null);
    setFormOpen(true);
  };

  const openEditForm = (company: Company) => {
    setEditingId(company.id);
    setForm({
      companyName: company.companyName,
      startDate: company.startDate,
      endDate: company.endDate,
      isCurrent: company.isCurrent,
      department: company.department,
      responsibilities: company.responsibilities,
    });
    setErrorMsg(null);
    setFormOpen(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMsg(null);
    setFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.companyName.trim()) {
      setErrorMsg('회사명을 입력해 주세요.');
      return;
    }
    if (!BLUEPRINT_LIMITS.company.startDate.pattern.test(form.startDate.trim())) {
      setErrorMsg('입사일(시작일)을 YYYY-MM-DD 또는 YYYY-MM 형식으로 입력해 주세요.');
      return;
    }
    if (!form.isCurrent && form.endDate.trim() && !BLUEPRINT_LIMITS.company.startDate.pattern.test(form.endDate.trim())) {
      setErrorMsg('퇴사일(종료일)을 YYYY-MM-DD 또는 YYYY-MM 형식으로 입력해 주세요.');
      return;
    }
    if (!form.department.trim()) {
      setErrorMsg('소속 부서를 입력해 주세요.');
      return;
    }
    if (!form.responsibilities.trim()) {
      setErrorMsg('담당 업무를 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveCompany(uid, form, editingId || undefined);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setFormOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCompany(uid, id);
      setConfirmDeleteId(null);
      if (editingId === id) {
        cancelForm();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  const currentCompaniesCount = companies.filter((c) => c.isCurrent).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            회사 등록
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            재직 중이거나 거쳐간 회사명, 재직기간, 소속 부서, 담당 업무를 등록하고 언제든 수정할 수 있습니다.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            회사 등록하기
          </button>
        )}
      </div>

      {/* 4-column Summary Strip (Flat hairline dividers, tabular numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">등록된 회사</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {companies.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">현재 재직 중</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-emerald-700">
            {currentCompaniesCount}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">누적 프로젝트</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {projects.length}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">누적 업무일지</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {dailyLogs.length}
          </div>
        </div>
      </div>

      {/* Company Create / Edit Form */}
      {(formOpen || (!loading && companies.length === 0)) && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? '회사 정보 수정' : '새 회사 등록'}
            </h2>
            {companies.length > 0 && (
              <button
                type="button"
                onClick={cancelForm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                닫기
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  회사명 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.company.companyName.maxLength}
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="예: (주)넥스트워크"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  소속 부서 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.company.department.maxLength}
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="예: 프로덕트 기획팀 / 플랫폼 개발실"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  재직 시작일 <span className="text-red-600">*</span>
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
                  재직 종료일
                </label>
                <input
                  type="date"
                  disabled={form.isCurrent}
                  value={form.isCurrent ? '' : form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="pb-2">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isCurrent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isCurrent: e.target.checked,
                        endDate: e.target.checked ? '' : form.endDate,
                      })
                    }
                    className="w-4 h-4 text-blue-700 border-slate-300 rounded focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">현재 재직 중</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                담당 업무 <span className="text-red-600">*</span>
              </label>
              <textarea
                required
                rows={4}
                maxLength={BLUEPRINT_LIMITS.company.responsibilities.maxLength}
                value={form.responsibilities}
                onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
                placeholder="주요 직무, 담당 서비스/도메인, 핵심 역할을 구체적으로 작성해 주세요."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <div className="mt-1 text-right text-xs font-mono tabular-nums text-slate-400">
                {form.responsibilities.length} / {BLUEPRINT_LIMITS.company.responsibilities.maxLength}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              {companies.length > 0 && (
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving ? '저장 중...' : editingId ? '수정 사항 저장' : '회사 등록 저장'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Registered Companies List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">등록된 회사 목록</h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            총 {companies.length}곳
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              아직 등록된 회사가 없습니다.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              위 양식에서 첫 번째 회사 정보를 등록하면 프로젝트와 업무일지를 회사별로 연결할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded-xl">
            {companies.map((company) => {
              const linkedProjects = projects.filter((p) => p.companyId === company.id).length;
              const linkedLogs = dailyLogs.filter((l) => l.companyId === company.id).length;

              return (
                <article key={company.id} className="p-6 transition-colors hover:bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {company.companyName}
                        </h3>
                        <span className="text-sm font-medium text-slate-600">
                          {company.department}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                        <span>
                          {company.startDate} ~ {company.isCurrent ? '재직 중' : company.endDate || '종료일 미입력'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={company.isCurrent ? 'text-emerald-700 font-medium font-sans' : 'text-slate-500 font-sans'}>
                          {company.isCurrent ? '재직 중' : '퇴사'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">프로젝트 {linkedProjects}건</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">업무일지 {linkedLogs}건</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(company)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        수정
                      </button>

                      {confirmDeleteId === company.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(company.id)}
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
                          onClick={() => setConfirmDeleteId(company.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 bg-white border border-slate-200 rounded-lg hover:border-red-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-xs font-medium text-slate-500 mb-1">담당 업무</div>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed max-w-3xl">
                      {company.responsibilities}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
