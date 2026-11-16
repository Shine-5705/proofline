// Headless invocations of the coding agents Proofline can drive in `proofline loop`.
// Each adapter takes a prompt and returns [command, args]. All of them edit files in cwd and exit.
import { spawn } from 'node:child_process';

export const AGENTS = {
  claude: (prompt) => ['claude', ['-p', prompt, '--permission-mode', 'acceptEdits', '--output-format', 'text']],
  codex: (prompt) => ['codex', ['exec', '--full-auto', prompt]],
  cursor: (prompt) => ['cursor-agent', ['-p', '--force', '--output-format', 'text', prompt]],
  gemini: (prompt) => ['gemini', ['-p', prompt, '--yolo']],
};

export function agentCommand(cfg, prompt, briefFile) {
  if (cfg.agent === 'custom') {
    if (!cfg.agentCommand) throw new Error('agent is "custom" but agentCommand is not set in proofline.config.json');
    const cmd = cfg.agentCommand.replaceAll('{brief}', briefFile).replaceAll('{prompt}', JSON.stringify(prompt));
    return ['sh', ['-c', cmd]];
  }
  const make = AGENTS[cfg.agent];
  if (!make) throw new Error(`Unknown agent "${cfg.agent}". Use one of: ${Object.keys(AGENTS).join(', ')}, custom`);
  return make(prompt);
}

export function runAgent(cfg, prompt, briefFile, { onOutput } = {}) {
  return new Promise((resolve) => {
    const [cmd, args] = agentCommand(cfg, prompt, briefFile);
    const started = Date.now();
    let out = '';
    const child = spawn(cmd, args, { cwd: cfg.root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const take = (d) => { const s = d.toString(); out += s; onOutput && onOutput(s); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (err) => resolve({ exitCode: 127, output: `Could not start ${cmd}: ${err.message}`, seconds: 0 }));
    child.on('close', (code) => resolve({ exitCode: code, output: out.slice(-20000), seconds: (Date.now() - started) / 1000 }));
  });
}
