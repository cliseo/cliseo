
import React, { useState, useEffect } from 'react';

interface TerminalProps {
  commands: {
    command: string;
    output?: string;
    delay?: number;
  }[];
}

const Terminal: React.FC<TerminalProps> = ({ commands }) => {
  const [visibleCommands, setVisibleCommands] = useState<number>(0);
  const [typing, setTyping] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (commandIndex < commands.length) {
      if (charIndex < commands[commandIndex].command.length) {
        setTyping(true);
        const timer = setTimeout(() => {
          setCurrentCommand(prev => prev + commands[commandIndex].command[charIndex]);
          setCharIndex(charIndex + 1);
        }, 50);
        return () => clearTimeout(timer);
      } else {
        setTyping(false);
        const outputDelay = commands[commandIndex].delay || 500;
        const timer = setTimeout(() => {
          setVisibleCommands(commandIndex + 1);
          setCommandIndex(commandIndex + 1);
          setCharIndex(0);
          setCurrentCommand('');
        }, outputDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [commands, commandIndex, charIndex, visibleCommands]);

  return (
    <div className="rounded-md bg-code-background text-code-foreground font-mono text-sm overflow-hidden border border-border/20 shadow-xl">
      <div className="flex items-center gap-1 px-4 py-2 bg-black/20">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="ml-2 text-xs text-gray-400">Terminal</span>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {commands.slice(0, visibleCommands).map((cmd, i) => (
          <div key={i} className="mb-4">
            <div className="flex">
              <span className="text-green-400 mr-2">$</span>
              <span>{cmd.command}</span>
            </div>
            {cmd.output && (
              <div className="mt-1 whitespace-pre-wrap text-gray-300">{cmd.output}</div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex">
            <span className="text-green-400 mr-2">$</span>
            <span>{currentCommand}</span>
            <span className="animate-cursor-blink ml-0.5">|</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
