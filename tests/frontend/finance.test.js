import { describe, it, expect } from 'vitest';
import {
  financialYearOf, basQuarterOf, periodOptions, filterByPeriod,
  shopLineEconomics, summariseShopSales, summariseMarketplace, basSummary,
  inventoryValuation, toCsv, SALES_CSV_COLUMNS, gstInsideCents,
} from '@/utils/finance.js';

describe('Australian periods', () => {
  it('financial year runs 1 July → 30 June', () => {
    const fy = financialYearOf(new Date(2026, 8, 23)); // 23 Sep 2026
    expect(fy.label).toBe('FY2026-27');
    expect(fy.start.getMonth()).toBe(6); expect(fy.start.getFullYear()).toBe(2026);
    expect(fy.end.getMonth()).toBe(5); expect(fy.end.getDate()).toBe(30); expect(fy.end.getFullYear()).toBe(2027);
    expect(financialYearOf(new Date(2027, 2, 1)).label).toBe('FY2026-27');
    expect(financialYearOf(new Date(2027, 6, 1)).label).toBe('FY2027-28');
  });

  it('BAS quarters follow the FY (Q1 = Jul–Sep)', () => {
    expect(basQuarterOf(new Date(2026, 8, 23)).label).toMatch(/^Q1 FY2026-27 \(Jul–Sep 2026\)/);
    expect(basQuarterOf(new Date(2026, 11, 1)).label).toMatch(/^Q2 FY2026-27 \(Oct–Dec 2026\)/);
    const q3 = basQuarterOf(new Date(2027, 1, 14));
    expect(q3.label).toMatch(/^Q3 FY2026-27 \(Jan–Mar 2027\)/);
    expect(q3.end.getMonth()).toBe(2); expect(q3.end.getDate()).toBe(31);
    expect(basQuarterOf(new Date(2027, 4, 1)).label).toMatch(/^Q4 FY2026-27 \(Apr–Jun 2027\)/);
  });

  it('offers this/last FY and current/previous quarter without duplicates', () => {
    const opts = periodOptions(new Date(2026, 8, 23));
    expect(opts.map((o) => o.value)).toEqual(['all', 'fy2026', 'fy2025', 'fy2026q1', 'fy2025q4']);
    const rows = [{ created_at: '2026-08-01T00:00:00Z' }, { created_at: '2026-05-01T00:00:00Z' }, { created_at: 'garbage' }];
    expect(filterByPeriod(rows, opts[3])).toHaveLength(1);
    expect(filterByPeriod(rows, opts[0])).toHaveLength(3);
  });
});

const COSTS = new Map([
  ['p1', { wholesale_ex_gst_aud: '3.32', wholesale_inc_gst_aud: '3.65' }],
  ['p2', { wholesale_ex_gst_aud: null, wholesale_inc_gst_aud: '2.20' }],
]);

describe('shopLineEconomics', () => {
  it('splits GST out of an inclusive line and prefers the snapshot cost', () => {
    const l = shopLineEconomics({ id: 'p1', title: 'TL', quantity: 2, unit_price_aud: 9.99, line_total_aud: 19.98, gst_aud: 1.82, unit_cost_ex_gst_aud: 3.00, unit_cost_inc_gst_aud: 3.30 }, COSTS);
    expect(l.revenueInc).toBe(19.98);
    expect(l.gst).toBe(1.82);
    expect(l.revenueEx).toBe(18.16);
    expect(l.unitCostEx).toBe(3);          // snapshot, not the current 3.32
    expect(l.cogsEx).toBe(6);
    expect(l.gstCreditOnCogs).toBe(0.6);
    expect(l.grossProfit).toBe(12.16);
    expect(l.marginPct).toBeCloseTo(66.96, 1);
    expect(l.costSource).toBe('snapshot');
  });

  it('falls back to the current cost, deriving the ex-GST figure when only inc is stored', () => {
    const l = shopLineEconomics({ id: 'p2', quantity: 1, unit_price_aud: 5.99, line_total_aud: 5.99, gst_aud: 0.54 }, COSTS);
    expect(l.costSource).toBe('current');
    expect(l.unitCostEx).toBe(2);
    expect(l.grossProfit).toBe(3.45);
  });

  it('marks lines with no cost anywhere and derives GST when the line lacks it', () => {
    const l = shopLineEconomics({ id: 'nope', quantity: 1, unit_price_aud: 11 }, COSTS);
    expect(l.costSource).toBe('missing');
    expect(l.gst).toBe(1);
    expect(l.grossProfit).toBeNull();
    expect(l.cogsEx).toBe(0);
  });
});

const ORDERS = [
  { id: 'o-shop', status: 'payment_confirmed', created_at: '2026-09-13T00:00:00Z', seller_id: null, shipping_aud: '10.00', platform_fee_aud: '0', processing_fee_aud: '0', platform_gst_aud: '0', seller_gst_aud: '0', seller_proceeds_aud: '0', gst_aud: '0',
    order_items: [
      { id: 'p1', type: 'shop', title: 'Top Loaders', quantity: 1, unit_price_aud: 9.99, line_total_aud: 9.99, gst_aud: 0.91 },
      { id: 'p2', type: 'shop', title: 'Team Bags', quantity: 2, unit_price_aud: 5.99, line_total_aud: 11.98, gst_aud: 1.09 },
    ] },
  { id: 'o-market', status: 'completed', created_at: '2026-09-14T00:00:00Z', seller_id: 's1', shipping_aud: '8.00', platform_fee_aud: '11.00', processing_fee_aud: '2.40', platform_gst_aud: '1.22', seller_gst_aud: '9.82', seller_proceeds_aud: '97.00', gst_aud: '0',
    order_items: [{ id: 'l1', type: 'listing', title: 'Card', quantity: 1, unit_price_aud: 100, line_total_aud: 100, gst_aud: 9.09, seller_id: 's1' }] },
  { id: 'o-unpaid', status: 'pending', created_at: '2026-09-15T00:00:00Z', seller_id: null, shipping_aud: '10', order_items: [{ id: 'p1', type: 'shop', quantity: 5, unit_price_aud: 9.99, line_total_aud: 49.95, gst_aud: 4.54 }] },
];
const REFUNDS = [{ order_id: 'o-shop', status: 'processed', refund_amount_aud: '5.99' }, { order_id: 'o-shop', status: 'pending', refund_amount_aud: '100' }];

describe('summaries', () => {
  it('shop P&L counts only paid shop lines, adds shipping, subtracts settled refunds', () => {
    const s = summariseShopSales(ORDERS, COSTS, REFUNDS);
    expect(s.orderCount).toBe(1);
    expect(s.lineCount).toBe(2);
    expect(s.unitsSold).toBe(3);
    expect(s.salesInc).toBe(21.97);
    expect(s.gstOnSales).toBe(2);
    expect(s.salesEx).toBe(19.97);
    expect(s.shippingInc).toBe(10); expect(s.shippingGst).toBe(0.91); expect(s.shippingEx).toBe(9.09);
    expect(s.cogsEx).toBe(3.32 + 4);        // p1 ex 3.32 ×1 + p2 derived 2.00 ×2
    expect(s.grossProfit).toBe(12.65);
    expect(s.refunded).toBe(5.99);
    expect(s.linesUsingCurrentCost).toBe(2);
    expect(s.linesMissingCost).toBe(0);
  });

  it('marketplace split: fee revenue ex GST, seller GST kept separate', () => {
    const m = summariseMarketplace(ORDERS);
    expect(m.orderCount).toBe(1);
    expect(m.commissionInc).toBe(11);
    expect(m.processingFeeInc).toBe(2.4);
    expect(m.feesInc).toBe(13.4);
    expect(m.platformGst).toBe(1.22);
    expect(m.feesEx).toBe(12.18);
    expect(m.sellerGstRemitted).toBe(9.82);
    expect(m.sellerProceeds).toBe(97);
  });

  it('BAS summary combines both streams with ATO labels', () => {
    const s = summariseShopSales(ORDERS, COSTS, REFUNDS);
    const m = summariseMarketplace(ORDERS);
    const b = basSummary(s, m);
    expect(b.g1TotalSalesInc).toBe(21.97 + 10 + 13.4);
    expect(b.oneAGstOnSales).toBe(2 + 0.91 + 1.22);
    expect(b.oneBGstCreditsEstimate).toBe(s.gstCreditsOnCogs);
    expect(b.sellerGstRemittedOnBehalf).toBe(9.82);
    expect(b.netGstOwnSupplies).toBe(Math.round((4.13 - s.gstCreditsOnCogs) * 100) / 100);
    expect(b.netGstPayableIncludingSellers).toBe(Math.round((b.netGstOwnSupplies + 9.82) * 100) / 100);
  });
});

describe('inventoryValuation', () => {
  it('values stock at cost and retail and flags stocked products without a cost', () => {
    const inv = inventoryValuation([
      { id: 'p1', sku: 'TL', title: 'Top Loaders', status: 'active', price_aud: '9.99', stock_quantity: 10 },
      { id: 'p2', sku: 'TB', title: 'Team Bags', status: 'draft', price_aud: '5.99', stock_quantity: 3 },
      { id: 'p9', sku: 'X', title: 'No cost', status: 'active', price_aud: '20', stock_quantity: 2 },
      { id: 'p0', sku: 'Z', title: 'Out of stock, no cost', status: 'active', price_aud: '20', stock_quantity: 0 },
    ], COSTS);
    expect(inv.units).toBe(15);
    expect(inv.costValueEx).toBe(33.2 + 6);
    expect(inv.retailValueInc).toBe(99.9 + 17.97 + 40);
    expect(inv.missingCostWithStock).toBe(1);
    expect(inv.rows[0].sku).toBe('TL'); // sorted by value at cost
    expect(inv.potentialGrossProfit).toBeCloseTo(inv.retailValueEx - inv.costValueEx, 2);
  });
});

describe('toCsv', () => {
  it('quotes commas and quotes, formats money to 2dp', () => {
    const s = summariseShopSales(ORDERS, COSTS, REFUNDS);
    const csv = toCsv(s.lines.map((l) => ({ ...l, title: 'Bags, "resealable"' })), SALES_CSV_COLUMNS);
    const [header, first] = csv.split('\n');
    expect(header.startsWith('Order date,Order ref,Order status,Product')).toBe(true);
    expect(first).toContain('"Bags, ""resealable"""');
    expect(first).toContain(',9.99,0.91,9.08,');
    expect(csv.endsWith('\n')).toBe(true);
  });
});

describe('gstInsideCents', () => {
  it('extracts 1/11 at 10%', () => {
    expect(gstInsideCents(1100)).toBe(100);
    expect(gstInsideCents(999)).toBe(91);
  });
});
