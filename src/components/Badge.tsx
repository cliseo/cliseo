
import React from 'react';

interface BadgeProps {
  type: 'license' | 'downloads' | 'stars';
  value: string;
}

const Badge: React.FC<BadgeProps> = ({ type, value }) => {
  const getColors = () => {
    switch (type) {
      case 'license':
        return { bg: 'bg-blue-950', text: 'text-blue-300' };
      case 'downloads':
        return { bg: 'bg-green-950', text: 'text-green-300' };
      case 'stars':
        return { bg: 'bg-yellow-950', text: 'text-yellow-300' };
      default:
        return { bg: 'bg-gray-800', text: 'text-gray-300' };
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'license':
        return 'license';
      case 'downloads':
        return 'downloads';
      case 'stars':
        return 'stars';
    }
  };

  const { bg, text } = getColors();
  const label = getLabel();

  return (
    <div className="inline-flex items-center rounded-md overflow-hidden shadow-sm border border-white/10">
      <div className="px-2 py-0.5 bg-white/10 text-gray-300 text-xs">
        {label}
      </div>
      <div className={`px-2 py-0.5 ${bg} ${text} text-xs font-medium`}>
        {value}
      </div>
    </div>
  );
};

export default Badge;
