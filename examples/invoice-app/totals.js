// Invoice arithmetic. Amounts are integer paise to avoid floating-point drift.
export const GST_RATE = 0.18;

export function lineAmount(line) {
  return Math.round(Number(line.qty || 0) * Math.round(Number(line.rate || 0) * 100));
}

export function totals(invoice) {
  const subtotal = invoice.lines.reduce((a, l) => a + lineAmount(l), 0);
  const discount = Math.round(subtotal * (Number(invoice.discountPct || 0) / 100));
  const taxable = subtotal - discount;
  const gst = Math.round(taxable * GST_RATE); // GST is charged on the discounted (taxable) amount
  return { subtotal, discount, taxable, gst, total: taxable + gst };
}

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const money = (paise) => fmt.format(paise / 100);
