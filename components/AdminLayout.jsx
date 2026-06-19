import React from 'react';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
  // Single shared width container for every admin page, matching the dashboard,
  // so pages render at a consistent "normal" page width instead of edge-to-edge.
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Outlet />
    </div>
  );
};

export default AdminLayout;
