import React from 'react';

/**
 * FormattedQuestionText Component
 * Cleans up raw symbols like #, ##, $, $$, and renders clean readable text,
 * properly formatting inline math and code snippets without raw symbol clutter.
 */
export const FormattedQuestionText = ({ text = '', className = '' }) => {
  if (!text) return null;

  // 1. Clean up leading markdown hashes (###, ##, #) from lines
  let cleaned = text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, ''))
    .join('\n');

  // 2. Parse inline math ($...$) and code (`...`) into formatted spans
  // E.g. $N$ -> N (in italics/font-mono), $O(\log N)$ -> O(log N)
  const renderFormattedParagraph = (str, pIdx) => {
    // Regex splits by `$math$` or ``code``
    const parts = str.split(/(\$[^$]+\$|`[^`]+`)/g);

    return (
      <p key={pIdx} className="leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('$') && part.endsWith('$')) {
            // LaTeX / Math expression: clean and format elegantly
            const mathContent = part
              .slice(1, -1)
              .replace(/\\log/g, 'log')
              .replace(/\\leq/g, '≤')
              .replace(/\\geq/g, '≥')
              .replace(/\\neq/g, '≠')
              .replace(/\\times/g, '×');

            return (
              <span
                key={idx}
                className="font-mono text-indigo-300 font-semibold italic px-1 py-0.5 rounded bg-indigo-950/40 text-[0.95em]"
              >
                {mathContent}
              </span>
            );
          } else if (part.startsWith('`') && part.endsWith('`')) {
            // Inline code snippet
            const codeContent = part.slice(1, -1);
            return (
              <code
                key={idx}
                className="font-mono text-cyan-300 px-1.5 py-0.5 rounded bg-slate-800 text-[0.9em] border border-slate-700/60"
              >
                {codeContent}
              </code>
            );
          }
          return part;
        })}
      </p>
    );
  };

  const paragraphs = cleaned.split('\n').filter((p) => p.trim().length > 0);

  return (
    <div className={`space-y-2 ${className}`}>
      {paragraphs.map((p, i) => renderFormattedParagraph(p, i))}
    </div>
  );
};
