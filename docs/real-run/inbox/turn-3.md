# Proofline: Kane CLI rejected this change

Original task: Ship the billing change in totals.js and fix anything Kane flags

Attempt 1 of 4.

Kane CLI ran 3 flow(s) against the app in a real browser. 1 did not pass.

## Create an invoice with a discount (flows/create_invoice_test.md)
- Verdict: failed (exit 1)
- Failing step 5: Check the totals: The invoice summary applies GST to the ₹35,000 subtotal instead of the discounted ₹31,500 amount.
- Kane summary: A 10% discount reduces ₹35,000 to ₹31,500, so 18% GST should be ₹5,670 and the total should be ₹37,170. The displayed summary instead shows ₹6,300 GST and ₹37,800 total, which means tax was calculated before the discount was applied.
  Update the invoice calculation so GST is calculated after subtracting the discount: ₹31,500 × 18% = ₹5,670, then show a ₹37,170 total.
  evidence: objective_contradiction: Final verification failed: "the summary shows Subtotal ₹35,000, Discount − ₹3,500, GST 18% ₹5,670 and Total ₹37,170"
- Reason: Final verification failed: "the summary shows Subtotal ₹35,000, Discount − ₹3,500, GST 18% ₹5,670 and Total ₹37,170"
- Evidence pack (screenshots, console, network): /home/box/.testmuai/kaneai/sessions/8dd556bc-3925-4325-824d-ea6e8b9ac87e/evidence/0fe868cf-5e34-47f5-9010-3f83a306fe23.evidence
- Last steps Kane took:
  2. [passed] Start a new invoice
  3. [passed] Add two line items
  4. [passed] Apply a discount
  5. [failed] Check the totals: The invoice summary applies GST to the ₹35,000 subtotal instead of the discounted ₹31,500 amount.

## What to do
1. Read the failing step and fix the application code so the flow passes. The flow describes intended behaviour.
2. Only edit a *_test.md flow if the requirement itself changed; say so explicitly if you do.
3. Stop when you are done editing. Proofline re-runs Kane CLI on the affected flows automatically.