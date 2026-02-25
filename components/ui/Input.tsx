import React from 'react';
import { Tooltip } from './Tooltip';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  prefix?: string;
  tooltip?: string;
}

export const Input: React.FC<InputProps> = ({ label, prefix, tooltip, className, ...props }) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center pl-1">
        {tooltip ? (
          <Tooltip text={tooltip}>
            <label className="text-xs uppercase tracking-widest text-neutral-500 font-mono">
              {label}
            </label>
          </Tooltip>
        ) : (
          <label className="text-xs uppercase tracking-widest text-neutral-500 font-mono">
            {label}
          </label>
        )}
      </div>
      <div className="relative group">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-lg z-10">
            {prefix}
          </span>
        )}
        <input
          {...props}
          className={`
            w-full bg-neutral-900/50 border border-neutral-800 rounded-lg 
            py-2 ${prefix ? 'pl-10' : 'pl-4'} pr-4 
            text-xl font-mono text-white placeholder-neutral-700
            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50
            transition-all duration-300 shadow-inner
            ${className}
          `}
        />
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
      </div>
    </div>
  );
};