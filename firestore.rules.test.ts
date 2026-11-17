// Security verification test specification for Firestore rules (Dirty Dozen suite).
// Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const dirtyDozenCases: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on user companies',
    operation: 'get',
    path: '/users/userA/companies/comp1',
    authUid: null,
    emailVerified: false,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-tenant list on another user dailyLogs',
    operation: 'list',
    path: '/users/userA/dailyLogs',
    authUid: 'userB',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity spoofing userId on create',
    operation: 'create',
    path: '/users/userA/companies/comp1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userB',
      companyName: 'Acme',
      startDate: '2024-01-01',
      endDate: '',
      isCurrent: true,
      department: 'Engineering',
      responsibilities: 'Backend',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow field injection on WorkTag create',
    operation: 'create',
    path: '/users/userA/tags/tag1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userA',
      name: '윤문',
      description: '문서 다듬기',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified email write attempt',
    operation: 'create',
    path: '/users/userA/companies/comp1',
    authUid: 'userA',
    emailVerified: false,
    payload: {
      userId: 'userA',
      companyName: 'Acme',
      startDate: '2024-01-01',
      endDate: '',
      isCurrent: true,
      department: 'Engineering',
      responsibilities: 'Backend',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Path variable ID poisoning',
    operation: 'create',
    path: '/users/userA/projects/' + 'x'.repeat(130),
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userA',
      projectName: 'Poison',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immortal field mutation (createdAt / userId)',
    operation: 'update',
    path: '/users/userA/companies/comp1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userB',
      companyName: 'Updated',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged timestamp on create',
    operation: 'create',
    path: '/users/userA/dailyLogs/log1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userA',
      workDate: '2026-11-16',
      coreTask: 'Write spec',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized string Denial-of-Wallet payload',
    operation: 'create',
    path: '/users/userA/dailyLogs/log1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userA',
      workDate: '2026-11-16',
      coreTask: 'A'.repeat(5000),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unbounded array overflow on tagIds',
    operation: 'create',
    path: '/users/userA/dailyLogs/log1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userA',
      workDate: '2026-11-16',
      tagIds: Array.from({ length: 20 }, (_, i) => `t${i}`),
      coreTask: 'Overflow tags',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Array type poisoning (non-string tagId)',
    operation: 'create',
    path: '/users/userA/dailyLogs/log1',
    authUid: 'userA',
    emailVerified: true,
    payload: {
      userId: 'userA',
      workDate: '2026-11-16',
      tagIds: [12345],
      coreTask: 'Type poison',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Orphan subcollection write without parent workspace doc',
    operation: 'create',
    path: '/users/userNoWorkspace/companies/comp1',
    authUid: 'userNoWorkspace',
    emailVerified: true,
    payload: {
      userId: 'userNoWorkspace',
      companyName: 'Orphan Corp',
    },
    expected: 'PERMISSION_DENIED',
  },
];
