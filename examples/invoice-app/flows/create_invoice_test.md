---
mode: testing
tags: [smoke, billing]
---

# Create an invoice with a discount

## Open a fresh workspace
Open http://localhost:4173/#/reset and verify the Invoices heading is visible.

## Start a new invoice
Click "New invoice". Type "Acme Robotics" in the Client field.

## Add two line items
In line 1 enter item "Design sprint", quantity 2, rate 15000. Click "Add line". In line 2 enter item "QA pass", quantity 1, rate 5000.

## Apply a discount
Set Discount (%) to 10 and click outside the field.

## Check the totals
Verify the summary shows Subtotal ₹35,000, Discount − ₹3,500, GST 18% ₹5,670 and Total ₹37,170.

## Save
Click "Save invoice". Verify the page shows "Acme Robotics" with status Draft and Total ₹37,170.
