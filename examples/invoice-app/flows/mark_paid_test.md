---
mode: testing
tags: [smoke, billing]
---

# Mark a sent invoice as paid

## Open the invoice list
Open http://localhost:4173/#/reset and verify the Invoices heading is visible.

## Open Kestrel Logistics
Click the row for "Kestrel Logistics" (INV-0003). Verify its status is Sent.

## Record payment
Click "Mark as paid". Verify the status badge now reads Paid and the "Mark as paid" button is gone.

## It sticks in the list
Click "Invoices" in the top navigation, choose "Paid" in the status filter, and verify "Kestrel Logistics" is listed.
