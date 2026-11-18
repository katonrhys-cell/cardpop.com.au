import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import LowStockMeter from '@/components/shop/LowStockMeter.jsx';
import StockLevel from '@/components/shop/StockLevel.jsx';
import { lowStockCount, stockCount, LOW_STOCK_THRESHOLD } from '@/utils/shopStock.js';

describe('lowStockCount', () => {
  it('returns the real stock only when it is running low', () => {
    expect(lowStockCount({ status: 'active', stock_quantity: 1 })).toBe(1);
    expect(lowStockCount({ status: 'active', stock_quantity: LOW_STOCK_THRESHOLD })).toBe(LOW_STOCK_THRESHOLD);
    expect(lowStockCount({ status: 'active', stockQuantity: 3 })).toBe(3);
    expect(lowStockCount({ status: 'active', stock_quantity: LOW_STOCK_THRESHOLD + 1 })).toBeNull();
  });

  it('says nothing for sold-out, untracked, pre-order or coming-soon products', () => {
    expect(lowStockCount({ status: 'active', stock_quantity: 0 })).toBeNull();
    expect(lowStockCount({ status: 'active', stock_quantity: null })).toBeNull();
    expect(lowStockCount({ status: 'preorder', stock_quantity: 2 })).toBeNull();
    expect(lowStockCount({ status: 'coming_soon', stock_quantity: 2 })).toBeNull();
    expect(lowStockCount(null)).toBeNull();
  });

  it('uses the chosen variant, and waits for one to be chosen', () => {
    const product = { status: 'active', stock_quantity: 40 };
    expect(lowStockCount(product, { stock_quantity: 2 }, { hasVariants: true })).toBe(2);
    expect(lowStockCount(product, { stock_quantity: 20 }, { hasVariants: true })).toBeNull();
    expect(lowStockCount({ status: 'active', stock_quantity: 3 }, null, { hasVariants: true })).toBeNull();
  });
});

describe('LowStockMeter', () => {
  it('shows the count and a proportional meter', () => {
    render(<LowStockMeter count={2} />);
    expect(screen.getByTestId('low-stock-meter').textContent).toContain('Only 2 left in stock');
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('2');
    expect(meter.firstChild.style.width).toBe('40%');
  });

  it('calls out the last one', () => {
    render(<LowStockMeter count={1} />);
    expect(screen.getByTestId('low-stock-meter').textContent).toContain('last one');
  });

  it('renders nothing without a low count', () => {
    const { container } = render(<><LowStockMeter count={null} /><LowStockMeter count={0} /><LowStockMeter count={9} /></>);
    expect(container.innerHTML).toBe('');
  });
});

describe('stockCount', () => {
  it('returns the real stock at any level', () => {
    expect(stockCount({ status: 'active', stock_quantity: 10 })).toBe(10);
    expect(stockCount({ status: 'active', stockQuantity: 3 })).toBe(3);
    expect(stockCount({ status: 'active', stock_quantity: 40 }, { stock_quantity: 20 }, { hasVariants: true })).toBe(20);
  });

  it('says nothing for sold-out, untracked, pre-order or coming-soon products, or before a variant is chosen', () => {
    expect(stockCount({ status: 'active', stock_quantity: 0 })).toBeNull();
    expect(stockCount({ status: 'active', stock_quantity: null })).toBeNull();
    expect(stockCount({ status: 'preorder', stock_quantity: 10 })).toBeNull();
    expect(stockCount({ status: 'coming_soon', stock_quantity: 10 })).toBeNull();
    expect(stockCount({ status: 'active', stock_quantity: 10 }, null, { hasVariants: true })).toBeNull();
    expect(stockCount(null)).toBeNull();
  });
});

describe('StockLevel', () => {
  it('shows a plain count above the low-stock threshold', () => {
    render(<StockLevel count={10} />);
    expect(screen.getByTestId('stock-level').textContent).toBe('10 in stock');
    expect(screen.queryByTestId('low-stock-meter')).toBeNull();
  });

  it('switches to the urgency meter at the threshold', () => {
    render(<StockLevel count={LOW_STOCK_THRESHOLD} />);
    expect(screen.getByTestId('low-stock-meter').textContent).toContain(`Only ${LOW_STOCK_THRESHOLD} left in stock`);
    expect(screen.queryByTestId('stock-level')).toBeNull();
  });

  it('renders nothing without a count', () => {
    const { container } = render(<><StockLevel count={null} /><StockLevel count={0} /></>);
    expect(container.innerHTML).toBe('');
  });
});
