---
mode: testing
tags: [dogfood, console]
---

# Console shows an agent ↔ Kane loop end to end

## Open the loops page
Open https://shine-5705.github.io/proofline/?demo#/loops and verify the heading "Loops" is visible and a banner at the top describes the workspace (sample data or an exported snapshot).

## Open the discount loop
Click the row "Add a percentage discount to the invoice editor". Verify the page shows "Loop closed green" and the labels "Turn 1" and "Turn 2".

## Read the repair brief
Click "Repair brief". Verify the expanded text contains "Kane CLI rejected this change".
