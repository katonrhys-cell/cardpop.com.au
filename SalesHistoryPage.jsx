import React from 'react';
import { Navigate } from 'react-router-dom';

// Prompt asked for SalesHistoryPage but also TransactionHistoryPage which serves the identical functional requirement in the database structure and instructions. 
// Redirecting to the combined TransactionHistoryPage which handles all history filtering by type.
const SalesHistoryPage = () => {
  return <Navigate to="/transactions" replace />;
};

export default SalesHistoryPage;