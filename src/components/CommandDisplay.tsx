import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommandDisplayProps {
  command: string;
  className?: string;
}

export function CommandDisplay({ command, className = '' }: CommandDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClick = (e: React.MouseEvent<HTMLPreElement>) => {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(e.currentTarget);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <pre
        onClick={handleClick}
        className="bg-black/40 rounded px-3 py-2 font-mono text-white text-base cursor-pointer select-none w-full"
      >
        <span className="text-gray-500">$</span> {command}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={handleCopy}
        tabIndex={0}
        aria-label="Copy command"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
} 