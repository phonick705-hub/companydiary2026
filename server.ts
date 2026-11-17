import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 서버 환경 변수에 설정되지 않았습니다.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage.includes('GEMINI_API_KEY')) {
    return { status: 500, message: rawMessage };
  }
  if (rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('403') || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API 키 권한 또는 유효성을 확인해 주세요. (Settings > Secrets 패널 확인)',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      message: 'API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
  return {
    status: 500,
    message: `AI 분석 요청 처리 중 오류가 발생했습니다: ${rawMessage}`,
  };
}

interface DailyLogInput {
  workDate: string;
  companyName?: string;
  projectName?: string;
  tags?: string[];
  todos?: Array<{ text: string; done: boolean; isCore: boolean }>;
  coreTask: string;
  process: string;
  outcome: string;
  challenges: string;
  solutions: string;
  learnings: string;
  improvements: string;
}

interface ProjectInput {
  projectName: string;
  companyName?: string;
  startDate: string;
  endDate: string;
  isOngoing: boolean;
  deliverables: string;
  learnings: string;
  challenges: string;
  conflicts: string;
  solutions: string;
  milestones?: Array<{ date: string; title: string; note: string }>;
}

interface CompanyInput {
  companyName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  department: string;
  responsibilities: string;
}

interface MonthlyReviewInput {
  monthKey: string;
  summary: string;
  newSkills: string;
  improvements: string;
  keyAchievements: string[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/ai/monthly-retrospective', async (req: Request, res: Response) => {
    try {
      const { monthKey, logs, projects } = req.body as {
        monthKey: string;
        logs: DailyLogInput[];
        projects: ProjectInput[];
      };

      if (!monthKey || !Array.isArray(logs)) {
        res.status(400).json({ error: '월(monthKey)과 업무일지 목록이 필요합니다.' });
        return;
      }

      if (logs.length === 0 && (!Array.isArray(projects) || projects.length === 0)) {
        res.status(400).json({ error: `${monthKey}에 작성된 업무일지나 관련 프로젝트 기록이 없어 회고를 생성할 수 없습니다.` });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `다음은 사용자가 ${monthKey} 한 달 동안 기록한 일일 업무일지와 관련 프로젝트 데이터입니다.`,
        `사용자의 실제 기록만을 근거로 사실적이고 구체적인 한국어 월간 회고를 작성해 주세요. 과장하거나 기록에 없는 사실을 지어내지 마세요.`,
        ``,
        `[일일 업무일지 (${logs.length}건)]`,
        JSON.stringify(logs, null, 2),
        ``,
        `[연관 프로젝트 (${Array.isArray(projects) ? projects.length : 0}건)]`,
        JSON.stringify(projects ?? [], null, 2),
        ``,
        `요구사항:`,
        `1. summary: 이번 달 업무의 전체 흐름과 주요 실행 내역을 3~5문장으로 구조화해 정리하세요.`,
        `2. newSkills: 기록에서 드러난 새롭게 습득한 지식, 도구, 기술, 업무 노하우를 구체적으로 정리하세요.`,
        `3. improvements: 기록된 어려움과 보완할 점을 바탕으로 아쉬웠던 점 및 다음 달 개선할 점을 정리하세요.`,
        `4. keyAchievements: 이번 달 핵심 성과를 정확히 3개에서 5개 사이의 간결하고 임팩트 있는 문장 배열로 작성하세요.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            '당신은 한국 직장인 및 엔지니어의 커리어 성장을 돕는 시니어 커리어 아키텍트입니다. 입력된 업무일지 데이터만을 기반으로 정확하고 명료한 한국어 회고를 작성합니다.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: '이번 달 업무 총괄 요약 (3~5문장)',
              },
              newSkills: {
                type: Type.STRING,
                description: '새롭게 습득한 지식 혹은 기술',
              },
              improvements: {
                type: Type.STRING,
                description: '아쉬웠던 점 및 개선할 점',
              },
              keyAchievements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '이번 달 핵심 성과 3~5가지',
              },
            },
            required: ['summary', 'newSkills', 'improvements', 'keyAchievements'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('AI 응답이 비어 있습니다.');
      }

      const parsed = JSON.parse(rawText) as {
        summary: string;
        newSkills: string;
        improvements: string;
        keyAchievements: string[];
      };

      res.json({
        summary: (parsed.summary ?? '').slice(0, 3900),
        newSkills: (parsed.newSkills ?? '').slice(0, 2900),
        improvements: (parsed.improvements ?? '').slice(0, 2900),
        keyAchievements: Array.isArray(parsed.keyAchievements)
          ? parsed.keyAchievements.slice(0, 5).map((item) => String(item).slice(0, 480))
          : [],
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/career-synthesis', async (req: Request, res: Response) => {
    try {
      const { targetRole, companies, projects, dailyLogs, monthlyReviews } = req.body as {
        targetRole?: string;
        companies: CompanyInput[];
        projects: ProjectInput[];
        dailyLogs: DailyLogInput[];
        monthlyReviews: MonthlyReviewInput[];
      };

      const totalRecords =
        (Array.isArray(companies) ? companies.length : 0) +
        (Array.isArray(projects) ? projects.length : 0) +
        (Array.isArray(dailyLogs) ? dailyLogs.length : 0) +
        (Array.isArray(monthlyReviews) ? monthlyReviews.length : 0);

      if (totalRecords === 0) {
        res.status(400).json({
          error: '분석할 회사, 프로젝트 또는 업무일지 데이터가 없습니다. 먼저 기록을 추가해 주세요.',
        });
        return;
      }

      const ai = getGeminiClient();

      const prompt = [
        `사용자가 지금까지 축적한 전체 커리어 데이터베이스(회사, 프로젝트, 일일 업무일지, 월간 회고)를 분석하여`,
        `자기소개서 작성과 면접 답변에 바로 활용할 수 있는 통합 커리어 리포트를 생성해 주세요.`,
        targetRole ? `목표 직무/지원 분야: ${targetRole}` : `목표 직무: 입력된 경력 및 업무 성격에 기반한 종합 직무`,
        ``,
        `핵심 지침 (중복 병합 필수):`,
        `- 여러 날짜에 걸쳐 반복적으로 기록된 유사 업무, 동일 프로젝트의 연속 작업, 월간 회고와 일일 로그에 중복 등장하는 성과는 **반드시 하나의 대표 경험(dedupedExperiences)으로 통합/병합**하세요.`,
        `- 각 통합 경험마다 몇 개의 원본 기록/일지가 병합되었는지 mergedFromCount 정수로 명시하세요.`,
        `- 각 통합 경험은 STAR 기법(Situation, Task, Action, Result)으로 구조화하세요.`,
        `- 입력된 데이터에 없는 성과나 수치를 절대 지어내지 마세요.`,
        ``,
        `[1. 회사 경력 (${companies?.length ?? 0}건)]`,
        JSON.stringify(companies ?? [], null, 2),
        ``,
        `[2. 프로젝트 기록 (${projects?.length ?? 0}건)]`,
        JSON.stringify(projects ?? [], null, 2),
        ``,
        `[3. 일일 업무일지 (${dailyLogs?.length ?? 0}건)]`,
        JSON.stringify(dailyLogs ?? [], null, 2),
        ``,
        `[4. 월간 회고 (${monthlyReviews?.length ?? 0}건)]`,
        JSON.stringify(monthlyReviews ?? [], null, 2),
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            '당신은 대기업·스타트업 채용 평가자이자 커리어 코치입니다. 산발적으로 기록된 수많은 일일 업무일지와 프로젝트에서 중복을 제거하고 의미 단위로 클러스터링하여, 자기소개서와 면접에서 설득력 있는 한국어 커리어 자산으로 재구성합니다.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: '통합 커리어 리포트 제목',
              },
              dedupedExperiences: {
                type: Type.ARRAY,
                description: '중복된 업무·경험을 하나로 묶어 정리한 핵심 경험 클러스터 목록 (최대 12개)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: '통합된 대표 경험 제목' },
                    mergedFromCount: { type: Type.INTEGER, description: '하나로 통합된 원본 일지/기록 수' },
                    period: { type: Type.STRING, description: '경험 기간 (예: 2026-09 ~ 2026-11)' },
                    situation: { type: Type.STRING, description: 'STAR - Situation (배경 및 문제 상황)' },
                    task: { type: Type.STRING, description: 'STAR - Task (해결해야 할 과제/목표)' },
                    action: { type: Type.STRING, description: 'STAR - Action (본인이 수행한 구체적 행동과 해결 방법)' },
                    result: { type: Type.STRING, description: 'STAR - Result (결과, 성과 및 배운 점)' },
                    keywords: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: '핵심 역량 및 직무 키워드 (최대 6개)',
                    },
                  },
                  required: ['title', 'mergedFromCount', 'period', 'situation', 'task', 'action', 'result', 'keywords'],
                },
              },
              resumeSections: {
                type: Type.ARRAY,
                description: '자기소개서 문항별 활용 초안 (직무 역량, 문제 해결, 협업/갈등 해결, 성장/학습 등 3~5개)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, description: '자소서 문항 유형 (예: 직무 역량, 문제 해결, 협업 및 갈등 해결)' },
                    headline: { type: Type.STRING, description: '소제목' },
                    draft: { type: Type.STRING, description: '실제 자기소개서에 활용 가능한 한국어 초안 (400~700자)' },
                  },
                  required: ['category', 'headline', 'draft'],
                },
              },
              interviewQuestions: {
                type: Type.ARRAY,
                description: '데이터베이스 기반 예상 면접 질문 및 답변 가이드 (4~8개)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING, description: '예상 면접 질문' },
                    intent: { type: Type.STRING, description: '면접관의 질문 의도' },
                    answerGuide: { type: Type.STRING, description: '사용자 실제 경험에 기반한 구조화된 답변 가이드' },
                  },
                  required: ['question', 'intent', 'answerGuide'],
                },
              },
            },
            required: ['title', 'dedupedExperiences', 'resumeSections', 'interviewQuestions'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('AI 응답이 비어 있습니다.');
      }

      const parsed = JSON.parse(rawText) as {
        title: string;
        dedupedExperiences: Array<{
          title: string;
          mergedFromCount: number;
          period: string;
          situation: string;
          task: string;
          action: string;
          result: string;
          keywords: string[];
        }>;
        resumeSections: Array<{
          category: string;
          headline: string;
          draft: string;
        }>;
        interviewQuestions: Array<{
          question: string;
          intent: string;
          answerGuide: string;
        }>;
      };

      res.json({
        title: String(parsed.title || '커리어 통합 분석 리포트').slice(0, 140),
        dedupedExperiences: (parsed.dedupedExperiences ?? []).slice(0, 20).map((exp) => ({
          title: String(exp.title || '경험').slice(0, 190),
          mergedFromCount: Math.max(1, Math.round(Number(exp.mergedFromCount) || 1)),
          period: String(exp.period || '').slice(0, 75),
          situation: String(exp.situation || '').slice(0, 1450),
          task: String(exp.task || '').slice(0, 1450),
          action: String(exp.action || '').slice(0, 1950),
          result: String(exp.result || '').slice(0, 1450),
          keywords: Array.isArray(exp.keywords)
            ? exp.keywords.slice(0, 10).map((k) => String(k).slice(0, 55))
            : [],
        })),
        resumeSections: (parsed.resumeSections ?? []).slice(0, 10).map((sec) => ({
          category: String(sec.category || '직무 역량').slice(0, 95),
          headline: String(sec.headline || '제목').slice(0, 190),
          draft: String(sec.draft || '').slice(0, 3900),
        })),
        interviewQuestions: (parsed.interviewQuestions ?? []).slice(0, 15).map((q) => ({
          question: String(q.question || '').slice(0, 390),
          intent: String(q.intent || '').slice(0, 390),
          answerGuide: String(q.answerGuide || '').slice(0, 2900),
        })),
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
