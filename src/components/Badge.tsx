import React from 'react';

interface BadgeProps {
  type: 'license' | 'downloads' | 'stars' | 'free' | 'ai' | 'scan' | 'optimize' | 'success' | 'pending';
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
      case 'free':
        return { bg: 'bg-gray-950', text: 'text-gray-300' };
      case 'ai':
        return { bg: 'bg-purple-950', text: 'text-purple-300' };
      case 'scan':
        return { bg: 'bg-cyan-950', text: 'text-cyan-300' };
      case 'optimize':
        return { bg: 'bg-green-950', text: 'text-green-300' };
      case 'success':
        return { bg: 'bg-green-950', text: 'text-green-300' };
      case 'pending':
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
      case 'free':
      case 'ai':
      case 'scan':
      case 'optimize':
      case 'success':
      case 'pending':
        return type;
      default:
        return '';
    }
  };

  const { bg, text } = getColors();
  const label = getLabel();

  return (
    <div className="inline-flex items-center rounded-md overflow-hidden shadow-sm border border-white/10">
      {label && (
        <div className="px-2 py-0.5 bg-white/10 text-gray-300 text-xs">
          {label}
        </div>
      )}
      <div className={`px-2 py-0.5 ${bg} ${text} text-xs font-medium`}>
        {value}
      </div>
    </div>
  );
};

export default Badge;
