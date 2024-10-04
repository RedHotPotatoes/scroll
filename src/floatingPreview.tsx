import React from 'react';
import './styles/floatingPreview.css';

interface FloatingPreviewProps {
  url: string;
  x: number;
  y: number;
}

const FloatingPreview: React.FC<FloatingPreviewProps> = ({ url, x, y }) => {
  return (
    <div className="floating-preview" style={{ bottom: `calc(100vh - ${y}px + 15px)` }}>
      <p>{url}</p>
    </div>
  );
};

export default FloatingPreview;
