# Recording the real Kane CLI loop (≈15 minutes)

> **Done on 16 Nov 2026.** Results, run IDs and who the agent was: see "Real run" in the main README and
> [docs/real-run/](real-run/). This page stays as the how-to for repeating it.


The hackathon scores three bars: the app works, **Kane CLI caught or proved something**, and **the agent and Kane CLI
talked to each other**. This is the exact sequence to capture both on your own machine.

## 0. One-time setup
```bash
# TestMu AI account (free tier includes starter credits). Use the same email you registered with on Luma.
#   https://www.testmuai.com/register/
npm install -g @testmuai/kane-cli
kane-cli login --oauth          # browser sign-in
kane-cli balance                # confirm credits

git clone https://github.com/Shine-5705/proofline && cd proofline
npm run demo                    # app on :4173, console on :4317 (leave running)
```

## 1. Green baseline (proves the flows)
```bash
cd examples/invoice-app
node ../../bin/proofline.mjs check      # 3 flows, first run authors each step (uses credits)
node ../../bin/proofline.mjs check      # second run replays from the recording (fast, free)
```
Open http://localhost:4317 → Runs. These are real Kane CLI runs.

## 2. Kane catches a bug → agent fixes it → Kane re-verifies (closes the loop)

**Option A — Cursor (recommended, hook already committed in `examples/invoice-app/.cursor/hooks.json`):**
1. Open `examples/invoice-app` as the Cursor workspace (not the repo root).
2. `node ../../scripts/scenario.mjs break` (plants: GST ignores the discount).
3. In Cursor Agent: *"Add a title attribute 'Invoice total' to the Total amount in the invoice editor's summary
   panel, then stop."* (A harmless change to `app.js`, which `create_invoice` guards.)
4. When the agent stops, the hook runs Kane on `create_invoice` (app.js changed) → Kane fails at the totals step →
   Cursor auto-submits the repair brief → the agent fixes `totals.js` → stops → Kane passes.

**Option B — Claude Code (hook committed in `examples/invoice-app/.claude/settings.json`):** same steps, run `claude` inside
`examples/invoice-app`.

**Option C — any CLI agent, no IDE:**
```bash
node ../../scripts/scenario.mjs break
node ../../bin/proofline.mjs loop "Fix whatever Kane finds" --verify-first --agent claude   # or codex / gemini / cursor
```

Screen-record steps 2–4 (≈60 s). Then open the console → Loops → the new loop for the red → green timeline.

## 3. Publish the real history to the hosted console
```bash
node ../../bin/proofline.mjs export ../../console/public/demo-workspace.json
# then edit "mode": "export" (already set by the command), rebuild and push:
cd ../.. && npm --prefix console run build && git add -A && git commit -m "Real Kane CLI run history" && git push
```
The hosted banner switches from "sample data" to "exported snapshot of real Kane CLI runs".

## 4. Video
Splice your ≈60 s screen recording after the 0:35 mark of `Proofline-Demo.mp4` (keep total under 3:00):
```bash
ffmpeg -i Proofline-Demo.mp4 -t 35 -c copy a.mp4
ffmpeg -i Proofline-Demo.mp4 -ss 35 -c copy b.mp4
# normalise your clip to 1280x720 30fps, then concat a.mp4 + real-loop.mp4 + b.mp4
```
