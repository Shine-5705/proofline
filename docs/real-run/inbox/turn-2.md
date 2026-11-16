# Proofline: Kane CLI rejected this change

Original task: Ship the billing change in totals.js and fix anything Kane flags

Attempt 1 of 4.

Kane CLI ran 3 flow(s) against the app in a real browser. 1 did not pass.

## Create an invoice with a discount (flows/create_invoice_test.md)
- Verdict: failed (exit 1)
- Failing step 5: Check the totals: The invoice summary applies 18% GST to ₹35,000 instead of the discounted ₹31,500 amount.
- Kane summary: The summary takes the tax from the full subtotal even though it has already applied the discount. This makes GST ₹6,300 and the total ₹37,800, rather than the expected ₹5,670 and ₹37,170.
  Calculate GST after subtracting the discount, then refresh the displayed GST and total.
  evidence: objective_contradiction: GST 18% ₹6,300
  evidence: objective_contradiction: Total ₹37,800
- Reason: Final verification failed: "the summary shows Subtotal ₹35,000, Discount − ₹3,500, GST 18% ₹5,670 and Total ₹37,170"
- Evidence pack (screenshots, console, network): /home/box/.testmuai/kaneai/sessions/6c630137-f9ad-47e1-8f95-cbfb1721094c/evidence/dc030dcc-35f7-4573-8b1e-b86de1922207.evidence
- Last steps Kane took:
  2. [passed] Start a new invoice
  3. [passed] Add two line items
  4. [passed] Apply a discount
  5. [failed] Check the totals: The invoice summary applies 18% GST to ₹35,000 instead of the discounted ₹31,500 amount.

## What to do
1. Read the failing step and fix the application code so the flow passes. The flow describes intended behaviour.
2. Only edit a *_test.md flow if the requirement itself changed; say so explicitly if you do.
3. Stop when you are done editing. Proofline re-runs Kane CLI on the affected flows automatically.