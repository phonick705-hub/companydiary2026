import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Hash,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { auth, googleProvider } from './lib/firebase';
import {
  ensureWorkspaceAndDefaultTags,
  subscribeCareerReports,
  subscribeCompanies,
  subscribeDailyLogs,
  subscribeMonthlyReviews,
  subscribeProjects,
  subscribeWorkTags,
} from './lib/firestoreService';
import type {
  CareerReport,
  Company,
  DailyLog,
  MonthlyReview,
  NavTab,
  Project,
  WorkTag,
} from './types/worklog';
import { CompaniesView } from './components/CompaniesView';
import { ProjectsView } from './components/ProjectsView';
import { DailyLogsView } from './components/DailyLogsView';
import { TagsView } from './components/TagsView';
import { MonthlyReviewView } from './components/MonthlyReviewView';
import { CareerSynthesisView } from './components/CareerSynthesisView';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: typeof Building2;
}> = [
  { id: 'companies', label: '회사 관리', icon: Building2 },
  { id: 'projects', label: '프로젝트', icon: FolderKanban },
  { id: 'daily', label: '오늘 한 일', icon: ClipboardList },
  { id: 'tags', label: '해시태그 관리', icon: Hash },
  { id: 'monthly', label: '월간 회고', icon: CalendarDays },
  { id: 'career', label: '자소서 · 면접 AI', icon: Briefcase },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('companies');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<WorkTag[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [careerReports, setCareerReports] = useState<CareerReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setWorkspaceReady(false);

      if (nextUser) {
        setDataLoading(true);
        try {
          await ensureWorkspaceAndDefaultTags(nextUser.uid, nextUser.displayName || '');
          setWorkspaceReady(true);
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : '워크스페이스 초기화에 실패했습니다.');
          setDataLoading(false);
        }
      } else {
        setCompanies([]);
        setProjects([]);
        setTags([]);
        setDailyLogs([]);
        setMonthlyReviews([]);
        setCareerReports([]);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !workspaceReady) return;

    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 6) {
        setDataLoading(false);
      }
    };

    const unsubs = [
      subscribeCompanies(user.uid, (items) => {
        setCompanies(items);
        markLoaded();
      }),
      subscribeProjects(user.uid, (items) => {
        setProjects(items);
        markLoaded();
      }),
      subscribeWorkTags(user.uid, (items) => {
        setTags(items);
        markLoaded();
      }),
      subscribeDailyLogs(user.uid, (items) => {
        setDailyLogs(items);
        markLoaded();
      }),
      subscribeMonthlyReviews(user.uid, (items) => {
        setMonthlyReviews(items);
        markLoaded();
      }),
      subscribeCareerReports(user.uid, (items) => {
        setCareerReports(items);
        markLoaded();
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [user, workspaceReady]);

  const handleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google 로그인 중 문제가 발생했습니다.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setActiveTab('companies');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '로그아웃에 실패했습니다.');
    }
  };

  const getCountForTab = (tab: NavTab): number | null => {
    switch (tab) {
      case 'companies':
        return companies.length;
      case 'projects':
        return projects.length;
      case 'daily':
        return dailyLogs.length;
      case 'tags':
        return tags.length;
      case 'monthly':
        return monthlyReviews.length;
      case 'career':
        return careerReports.length;
      default:
        return null;
    }
  };

  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">업무일지를 불러오는 중입니다...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              업무일지
            </span>
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={signingIn}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {signingIn ? '로그인 중...' : 'Google 로그인'}
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-3xl w-full bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 [text-wrap:balance]">
                매일의 업무 기록이 곧 커리어 자산이 되는 업무일지
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                회사 경력과 프로젝트 진행 과정, 오늘 한 일을 체계적으로 축적하고 AI 월간 회고 및 자기소개서·면접 대비 자료로 통합 정리해 보세요.
              </p>
            </div>

            {authError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {authError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">01. 회사 및 프로젝트 타임라인</h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  회사별 재직기간과 담당 업무를 등록하고, 프로젝트별 결과물·갈등·해결 방법과 상세 진행 날짜 순서를 관리합니다.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">02. 해시태그 기반 일일 업무일지</h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  윤문, 회의, 교육, 업무 자동화 등 커스텀 해시태그로 오늘의 핵심 업무, 과정, 결과, 배운 점을 기록합니다.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">03. AI 월간 회고 정리</h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  매달 쌓인 업무일지를 분석해 새롭게 습득한 지식·기술, 아쉬웠던 점, 핵심 성과 3~5가지를 자동으로 요약합니다.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">04. 중복 통합 자소서 · 면접 AI</h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  전체 데이터베이스에서 중복된 업무를 하나로 묶어 STAR 경험, 자기소개서 초안, 예상 면접 질문으로 변환합니다.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                모든 기록은 로그인한 개인 계정의 비공개 데이터베이스에 안전하게 저장됩니다.
              </p>
              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={signingIn}
                className="px-6 py-3 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {signingIn ? '연결 중...' : 'Google 계정으로 시작하기'}
              </button>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-slate-400">
          업무일지 · 개인 커리어 아카이브
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            업무일지
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="주 메뉴">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const count = getCountForTab(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {count !== null && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="min-w-0 px-1">
            <div className="text-xs font-medium text-slate-900 truncate">
              {user.displayName || '사용자'}
            </div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-full bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">업무일지</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const count = getCountForTab(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {count !== null && (
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-2">
              <div className="text-xs text-slate-600 truncate">{user.email}</div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header (Three-Zone Contract) */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap truncate">
              <span className="font-medium text-slate-900">업무일지</span>
              <span aria-hidden="true">/</span>
              <span>{activeNavMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeTab !== 'daily' ? (
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                오늘 한 일 기록
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('monthly')}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                월간 회고 보기
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {authError}
            </div>
          )}

          {activeTab === 'companies' && (
            <CompaniesView
              uid={user.uid}
              companies={companies}
              projects={projects}
              dailyLogs={dailyLogs}
              loading={dataLoading}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              uid={user.uid}
              companies={companies}
              projects={projects}
              dailyLogs={dailyLogs}
              loading={dataLoading}
            />
          )}

          {activeTab === 'daily' && (
            <DailyLogsView
              uid={user.uid}
              companies={companies}
              projects={projects}
              tags={tags}
              dailyLogs={dailyLogs}
              loading={dataLoading}
              onNavigateToTags={() => setActiveTab('tags')}
            />
          )}

          {activeTab === 'tags' && (
            <TagsView
              uid={user.uid}
              tags={tags}
              dailyLogs={dailyLogs}
              loading={dataLoading}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlyReviewView
              uid={user.uid}
              companies={companies}
              projects={projects}
              tags={tags}
              dailyLogs={dailyLogs}
              monthlyReviews={monthlyReviews}
              loading={dataLoading}
            />
          )}

          {activeTab === 'career' && (
            <CareerSynthesisView
              uid={user.uid}
              companies={companies}
              projects={projects}
              tags={tags}
              dailyLogs={dailyLogs}
              monthlyReviews={monthlyReviews}
              careerReports={careerReports}
              loading={dataLoading}
            />
          )}
        </main>
      </div>
    </div>
  );
}
