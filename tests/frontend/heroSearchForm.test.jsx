import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import HeroSection, { HeroSearchForm } from '@/components/HeroSection.jsx';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };

const renderForm = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<HeroSearchForm />} />
      <Route path="/search" element={<Where />} />
      <Route path="/marketplace" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('HeroSearchForm', () => {
  it('sends a query to the site-wide search', () => {
    renderForm();
    fireEvent.change(screen.getByRole('searchbox', { name: /search cards/i }), { target: { value: 'Charizard 4/102' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=Charizard%204%2F102');
  });

  it('an empty submit just opens the marketplace', () => {
    renderForm();
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('where')).toHaveTextContent('/marketplace');
  });
});

describe('HeroSection', () => {
  it('leads with buying: Shop Cards is the first call to action, selling is secondary', () => {
    render(<MemoryRouter><HeroSection /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/buy and sell trading cards/i);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent(/shop cards/i);
    expect(links[0]).toHaveAttribute('href', '/marketplace');
    expect(screen.getByRole('link', { name: /sell for free/i })).toHaveAttribute('href', '/signup?next=%2Fvault%2Fadd');
  });
});
