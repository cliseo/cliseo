
import React from 'react';

interface BadgeProps {
  type: 'license' | 'downloads' | 'stars';
  value: string;
}

const Badge: React.FC<BadgeProps> = ({ type, value }) => {
  const getColors = () => {
    switch (type) {
      case 'license':
        return { bg: 'bg-blue-100', text: 'text-blue-800' };
      case 'downloads':
        return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'stars':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800' };
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
    <div className="inline-flex items-center rounded-md overflow-hidden shadow-sm border border-border/20">
      <div className="px-2 py-0.5 bg-black/20 text-gray-200 text-xs">
        {label}
      </div>
      <div className={`px-2 py-0.5 ${bg} ${text} text-xs font-medium`}>
        {value}
      </div>
    </div>
  );
};

export default Badge;
