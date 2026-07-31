import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import './InfoTooltip.css';

export default function InfoTooltip({ text }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="info-tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      <HelpCircle size={16} className="info-icon" />
      {isVisible && (
        <div className="info-tooltip-box">
          {text}
        </div>
      )}
    </div>
  );
}
