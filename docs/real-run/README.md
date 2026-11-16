# Evidence: real Kane CLI runs, 16 Nov 2026

Copied unchanged from `examples/invoice-app/.proofline/` after the real run described in the main README
(times in the files are UTC; 16:00 UTC is 21:30 IST).

- `runs/<id>.ndjson`: the raw `kane-cli testmd run --agent` NDJSON stream for each run, exactly as Kane emitted it.
- `runs/<id>.json`: Proofline's record of that run (verdict, steps, Kane's diagnosis, Test Manager link), derived
  from the NDJSON (`scripts/reindex-runs.mjs` re-derives it).
- `loops/<id>.json`: each agent ↔ Kane loop: turns, diffs, the repair brief sent to the agent, the agent's note.
- `inbox/turn-N.md`: the repair brief handed to Grok Bot; `turn-N.done`: Grok Bot's note after editing.
  turn-1 = loop `loop_mwjgozqtc050f4`, turn-2 = the cancelled loop `loop_mwjh1258515046`, turn-3 = `loop_mwjh7db0c20bb3`.

| Loop | Result |
| --- | --- |
| `loop_mwjgozqtc050f4` | red → Grok Bot fix → green (first take) |
| `loop_mwjh1258515046` | cancelled by hand: exposed the empty-diff bug fixed in commit `dc04313` |
| `loop_mwjh7db0c20bb3` | red → Grok Bot fix → green (the take shown in the demo video) |
