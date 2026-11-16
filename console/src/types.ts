export type RunStatus = 'running' | 'passed' | 'failed' | 'not_started' | 'timeout' | 'error';
export type Verdict = 'green' | 'red' | 'blocked' | 'skipped' | 'agent_missing';
export type LoopStatus = 'running' | 'green' | 'gave_up' | 'blocked' | 'error' | 'skipped';

export interface Step { key: string; index: number; status: string; remark: string; ms: number | null }

export interface Run {
  id: string;
  flowId: string;
  flowFile: string;
  flowTitle: string;
  trigger: string;
  loopId: string | null;
  iteration: number | null;
  changedFiles: string[];
  git: { sha: string | null; dirty: boolean };
  kaneVersion: string | null;
  startedAt: string;
  endedAt?: string;
  status: RunStatus;
  exitCode?: number;
  summary?: string | null;
  reason?: string | null;
  duration?: number | null;
  credits?: number | null;
  testUrl?: string | null;
  evidence?: string | null;
  failedStep?: { index: number; remark: string } | null;
  steps: Step[];
  source: 'kane-cli' | 'demo';
  raw?: string | null;
}

export interface Iteration {
  n: number;
  startedAt: string;
  endedAt?: string;
  prompt: 'task' | 'repair-brief';
  agent?: { exitCode: number; seconds: number; outputTail?: string };
  diff?: { file: string; added: number; removed: number }[];
  runIds?: string[];
  verdict?: Verdict;
  brief?: string | null;
}

export interface Loop {
  id: string;
  task: string;
  agent: string;
  via?: string;
  startedAt: string;
  endedAt?: string;
  status: LoopStatus;
  iterations: Iteration[];
  maxIterations: number;
  source: 'kane-cli' | 'demo';
}

export interface Flow {
  id: string;
  file: string;
  title: string;
  tags: string[];
  steps: { title: string; text: string }[];
  covers: string[];
  recorded: boolean;
}

export interface Workspace {
  mode: 'local' | 'export' | 'demo';
  generatedAt: string;
  project: { name: string; root?: string; baseUrl: string; agent: string; maxIterations: number; flowsDir: string };
  flows: Flow[];
  runs: Run[];
  loops: Loop[];
}

export interface Readiness {
  kane: { version: string | null; loggedIn: boolean; balance?: number | null; detail: string };
  config: boolean;
  flows: number;
  agents: Record<string, boolean>;
  hooks: { claude: boolean; cursor: boolean };
}
