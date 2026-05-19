import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * This page has been deprecated and consolidated into ContentManagementPage.
 * Redirecting to the new unified content management interface.
 */
const ArticleManagementPage = () => {
  return <Navigate to="/admin/content" replace />;
};

export default ArticleManagementPage;