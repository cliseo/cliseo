
import React from 'react';

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  // Simple function to add syntax highlighting classes
  const highlightSyntax = (code: string, language: string) => {
    if (language === 'bash' || language === 'sh') {
      return code
        .replace(/(--[a-zA-Z0-9-_]+)/g, '<span class="text-code-variable">$1</span>')
        .replace(/(ezseo)/g, '<span class="text-code-function">$1</span>')
        .replace(/(scan|optimize)/g, '<span class="text-code-keyword">$1</span>')
        .replace(/(".*?")/g, '<span class="text-code-string">$1</span>')
        .replace(/(#.*$)/gm, '<span class="text-code-comment">$1</span>');
    }
    
    if (language === 'json') {
      return code
        .replace(/"([^"]+)":/g, '<span class="text-code-keyword">"$1"</span>:')
        .replace(/(:\s*")([^"]+)(")/g, ': <span class="text-code-string">"$2"</span>')
        .replace(/("\d+"|true|false|null)/g, '<span class="text-code-variable">$1</span>');
    }
    
    return code;
  };

  const highlightedCode = highlightSyntax(code, language);

  return (
    <div className="rounded-md bg-code-background text-code-foreground font-mono text-sm overflow-hidden shadow-lg border border-border/20">
      <div className="bg-black/30 px-4 py-2 text-xs flex justify-between">
        <span>{language}</span>
        <button className="text-gray-400 hover:text-white transition-colors">Copy</button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </div>
  );
};

export default CodeBlock;
