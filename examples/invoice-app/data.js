// Seed data for the example app. Fictional companies; clearly sample data.
export const SEED = [
  { id: 'INV-0001', client: 'Northwind Traders', issued: '2026-11-02', due: '2026-11-17', status: 'paid', discountPct: 0, lines: [{ item: 'Annual support plan', qty: 1, rate: 48000 }] },
  { id: 'INV-0002', client: 'Lumen Health', issued: '2026-11-05', due: '2026-11-20', status: 'sent', discountPct: 5, lines: [{ item: 'API integration', qty: 3, rate: 12500 }, { item: 'Security review', qty: 1, rate: 9000 }] },
  { id: 'INV-0003', client: 'Kestrel Logistics', issued: '2026-11-09', due: '2026-11-24', status: 'sent', discountPct: 0, lines: [{ item: 'Route optimiser licence', qty: 12, rate: 1800 }] },
  { id: 'INV-0004', client: 'Northwind Traders', issued: '2026-11-12', due: '2026-11-27', status: 'draft', discountPct: 10, lines: [{ item: 'Dashboard redesign', qty: 1, rate: 60000 }] },
];
