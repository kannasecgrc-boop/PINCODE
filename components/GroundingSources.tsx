import React from 'react';
import { GroundingChunk } from '../types';

interface GroundingSourcesProps {
  chunks: GroundingChunk[];
}

const GroundingSources: React.FC<GroundingSourcesProps> = ({ chunks }) => {
  if (!chunks || chunks.length === 0) return null;

  // Filter out chunks that don't have web URIs
  const webSources = chunks.filter(c => c.web?.uri && c.web?.title);

  if (webSources.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-slate-200">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Sources & Verification
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {webSources.map((source, idx) => (
          <a
            key={idx}
            href={source.web!.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-2 rounded-lg bg-white border border-slate-200 hover:border-primary/50 hover:shadow-sm transition-all group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate group-hover:text-primary">
                {source.web!.title}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {new URL(source.web!.uri).hostname}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default GroundingSources;