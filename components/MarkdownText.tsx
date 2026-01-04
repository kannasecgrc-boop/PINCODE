import React from 'react';

interface MarkdownTextProps {
  content: string;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ content }) => {
  // A very simple processor to handle basic markdown structure typically returned by Gemini
  // We avoid heavy libraries to keep it lightweight and "handful of files".
  
  const paragraphs = content.split('\n');

  return (
    <div className="space-y-3 text-slate-700 leading-relaxed">
      {paragraphs.map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
            return <h3 key={index} className="text-lg font-semibold text-slate-900 mt-4 mb-2">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('## ')) {
            return <h2 key={index} className="text-xl font-bold text-slate-900 mt-5 mb-3">{line.replace('## ', '')}</h2>;
        }
        if (line.startsWith('# ')) {
            return <h1 key={index} className="text-2xl font-bold text-slate-900 mt-6 mb-4">{line.replace('# ', '')}</h1>;
        }

        // List items
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            const cleanLine = line.replace(/^[\*\-]\s/, '');
            // Simple bold parser
            const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
            return (
                <div key={index} className="flex items-start ml-4">
                    <span className="mr-2 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60"></span>
                    <span>
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
                            }
                            return part;
                        })}
                    </span>
                </div>
            );
        }

        if (line.trim() === '') return <br key={index} className="hidden" />;

        // Standard Paragraph with bold support
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={index}>
             {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

export default MarkdownText;