import React, { useState } from 'react';
import { Check, Edit3, Hash, Plus, Trash2, X } from 'lucide-react';
import type { DailyLog, WorkTag } from '../types/worklog';
import { deleteWorkTag, saveWorkTag } from '../lib/firestoreService';
import { BLUEPRINT_LIMITS } from '../lib/validation';

interface TagsViewProps {
  uid: string;
  tags: WorkTag[];
  dailyLogs: DailyLog[];
  loading: boolean;
}

export const TagsView: React.FC<TagsViewProps> = ({ uid, tags, dailyLogs, loading }) => {
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanedName = newName.trim().replace(/^#/, '');
    if (!cleanedName) {
      setErrorMsg('해시태그 이름을 입력해 주세요.');
      return;
    }
    if (tags.some((t) => t.name.toLowerCase() === cleanedName.toLowerCase())) {
      setErrorMsg('이미 동일한 이름의 해시태그가 있습니다.');
      return;
    }

    setSaving(true);
    try {
      await saveWorkTag(uid, {
        name: cleanedName,
        description: newDescription.trim(),
      });
      setNewName('');
      setNewDescription('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '해시태그 추가 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tag: WorkTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditDescription(tag.description);
    setErrorMsg(null);
  };

  const handleSaveEdit = async (tagId: string) => {
    setErrorMsg(null);
    const cleanedName = editName.trim().replace(/^#/, '');
    if (!cleanedName) {
      setErrorMsg('해시태그 이름은 비워둘 수 없습니다.');
      return;
    }
    if (tags.some((t) => t.id !== tagId && t.name.toLowerCase() === cleanedName.toLowerCase())) {
      setErrorMsg('이미 동일한 이름의 해시태그가 존재합니다.');
      return;
    }

    setSaving(true);
    try {
      await saveWorkTag(
        uid,
        {
          name: cleanedName,
          description: editDescription.trim(),
        },
        tagId
      );
      setEditingId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '해시태그 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tagId: string) => {
    try {
      await deleteWorkTag(uid, tagId);
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '해시태그 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          업무 해시태그 관리
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          기본 해시태그(윤문, 회의, 교육, 업무 자동화, 기타) 외에 필요한 해시태그를 추가하거나 기존 태그 이름을 수정할 수 있습니다. 수정 시 기존 업무일지에도 즉시 반영됩니다.
        </p>
      </div>

      {/* Add Hashtag Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">새 해시태그 추가</h2>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              해시태그 이름 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.tag.name.maxLength}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 장애 대응, 리서치, 코드 리뷰"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              설명 (선택)
            </label>
            <input
              type="text"
              maxLength={BLUEPRINT_LIMITS.tag.description.maxLength}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="어떤 성격의 업무에 붙이는 태그인지 간단히 메모하세요."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>
        </form>
      </section>

      {/* Tag List Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">등록된 해시태그</h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            총 {tags.length}개
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <div className="p-10 text-center">
            <Hash className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm text-slate-600">등록된 해시태그가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {tags.map((tag) => {
              const usageCount = dailyLogs.filter((log) => log.tagIds.includes(tag.id)).length;
              const isEditing = editingId === tag.id;

              return (
                <div
                  key={tag.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50"
                >
                  {isEditing ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        maxLength={BLUEPRINT_LIMITS.tag.name.maxLength}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-1.5 text-sm font-medium bg-white border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <input
                        type="text"
                        maxLength={BLUEPRINT_LIMITS.tag.description.maxLength}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="설명"
                        className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm font-semibold text-slate-900">
                          #{tag.name}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                          사용 {usageCount}건
                        </span>
                      </div>
                      {tag.description && (
                        <p className="text-xs text-slate-500">{tag.description}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveEdit(tag.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(tag)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          편집
                        </button>
                        {confirmDeleteId === tag.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(tag.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
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
                            onClick={() => setConfirmDeleteId(tag.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 bg-white border border-slate-200 rounded-lg hover:border-red-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            삭제
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
