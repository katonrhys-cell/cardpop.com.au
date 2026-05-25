import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const CategorySidebar = ({ categories = [], className }) => {
  const { categorySlug } = useParams();

  return (
    <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
      <h3 className="font-semibold text-sm mb-3">Categories</h3>
      <ul className="space-y-0.5">
        <li>
          <Link
            to="/shop"
            className={cn(
              'block px-3 py-1.5 rounded-lg text-sm transition-colors',
              !categorySlug ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted'
            )}
          >
            All Cards
          </Link>
        </li>
        {categories.map(cat => (
          <li key={cat.id ?? cat.slug}>
            <Link
              to={`/shop/category/${cat.slug ?? cat.id}`}
              className={cn(
                'block px-3 py-1.5 rounded-lg text-sm transition-colors',
                categorySlug === (cat.slug ?? cat.id)
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted'
              )}
            >
              {cat.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategorySidebar;
