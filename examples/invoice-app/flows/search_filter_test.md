---
mode: testing
tags: [list]
---

# Search and filter invoices

## Open the invoice list
Open http://localhost:4173/#/reset and verify 4 invoices are listed.

## Search by client
Type "northwind" in the Search client box. Verify exactly 2 rows are shown and both are "Northwind Traders".

## Narrow by status
Choose "Draft" in the status filter. Verify exactly 1 row is shown: INV-0004.

## No results
Clear the search box and type "zzz". Verify the message "No invoices match" is visible.
