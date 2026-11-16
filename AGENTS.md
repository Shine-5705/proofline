# Instructions for coding agents working in this repo

This repository is guarded by **Proofline**. When you stop, a hook runs Kane CLI (TestMu AI) flows against the app
in a real browser. If a flow fails you will receive a *repair brief* naming the failing step. Fix the application
code so the flow passes; only edit a `*_test.md` flow if the requirement changed, and say so.

- Run the example app: `npm run example` (http://localhost:4173)
- Verify by hand: `cd examples/invoice-app && node ../../bin/proofline.mjs check`
- Unit tests: `npm test`
- Kane CLI usage for agents: https://www.testmuai.com/kane-cli-agent/AGENTS.md
