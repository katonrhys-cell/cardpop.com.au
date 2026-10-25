import React from 'react';
import { Helmet } from 'react-helmet-async';
import Breadcrumb from '@/components/Breadcrumb.jsx';

/**
 * The single layout every page under /account renders inside.
 *
 * Before this existed each account page rolled its own wrapper, so the section
 * drifted badly: some pages set the full `max-w-[90rem]` container, some set
 * `max-w-lg`, and several had no container at all (their root was just
 * `space-y-6`), which left them running edge-to-edge with zero gutters because
 * App.jsx's `<main>` adds no padding of its own. Headings drifted the same way
 * — `mb-1` vs `mb-2`, plain vs `tracking-tight`, and description text at three
 * different sizes.
 *
 * The container/heading values here are the dashboard's (AccountDashboard.jsx),
 * which is the reference design for the section. The container matches the
 * `.container-default` utility in index.css; it is spelled out rather than
 * using that class so the vertical rhythm and container live in one place.
 *
 * Props:
 *  - documentTitle: sets <title> (omit to manage Helmet in the page instead)
 *  - breadcrumb:    items array passed straight to <Breadcrumb>
 *  - title:         node — the h1 (a node so pages can inline an icon)
 *  - description:   node rendered under the h1
 *  - actions:       node — buttons that sit opposite the heading
 */
const AccountPageShell = ({
  documentTitle,
  breadcrumb,
  title,
  description,
  actions,
  children,
}) => (
  <div className="w-full max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-6 md:py-8 space-y-8">
    {documentTitle && (
      <Helmet>
        <title>{documentTitle}</title>
      </Helmet>
    )}

    {breadcrumb?.length > 0 && <Breadcrumb items={breadcrumb} />}

    {(title || actions) && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          {title && (
            <h1 className="text-3xl font-bold font-serif mb-2 tracking-tight text-foreground">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-muted-foreground text-lg font-medium">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            {actions}
          </div>
        )}
      </div>
    )}

    {children}
  </div>
);

export default AccountPageShell;
