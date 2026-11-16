# Proofline: Kane CLI rejected this change

Original task: Ship the billing change in totals.js and fix anything Kane flags

Attempt 1 of 4.

Kane CLI ran 3 flow(s) against the app in a real browser. 1 did not pass.

## Create an invoice with a discount (flows/create_invoice_test.md)
- Verdict: failed (exit 1)
- Failing step 5: Check the totals: assertion_failed: @ step 5
- Kane summary: After the 10% discount, the taxable amount should be ₹31,500. The screen instead shows GST of ₹6,300, which is 18% of the undiscounted ₹35,000, so the total becomes ₹37,800 rather than ₹37,170.
Update the invoice calculation so GST is calculated after subtracting the discount: ₹35,000 − ₹3,500 = ₹31,500; 18% GST = ₹5,670; total = ₹37,170.
evidence: objective_contradiction: GST 18% ₹6,300
evidence: objective_contradiction: ₹37,800
- Reason: Final verification failed: "the summary shows Subtotal ₹35,000, Discount − ₹3,500, GST 18% ₹5,670 and Total ₹37,170"
- Evidence pack (screenshots, console, network): /home/box/.testmuai/kaneai/sessions/155f1471-9dc4-4999-83f5-d4a2522918db/evidence/30665e0a-7c09-49d4-a864-4374cfa86953.evidence
- Last steps Kane took:
  2. [running] Start a new invoice
  3. [running] Add two line items
  4. [running] Apply a discount
  5. [running] Check the totals

## What to do
1. Read the failing step and fix the application code so the flow passes. The flow describes intended behaviour.
2. Only edit a *_test.md flow if the requirement itself changed; say so explicitly if you do.
3. Stop when you are done editing. Proofline re-runs Kane CLI on the affected flows automatically.