import React from 'react';

const DropZoneContainer = ({ children, onDrop, targetId, targetType, className = '' }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      onDrop?.(data, targetId, targetType);
    } catch {
      // ignore malformed drag data
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={className}
    >
      {children}
    </div>
  );
};

export default DropZoneContainer;
