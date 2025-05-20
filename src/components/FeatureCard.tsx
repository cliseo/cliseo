import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  icon: Icon, 
  title, 
  description 
}) => {
  return (
    <div className="p-4 text-base rounded-lg border border-white/10 hover:border-primary/50 transition-all duration-300 bg-card/50 hover:bg-primary/5 hover:translate-y-[-2px]">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
};

export default FeatureCard;
