import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  headerAside?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  icon,
  headerAside,
}) => {
  const hasHeader = title || icon || headerAside;

  return (
    <div className={`glass-panel rounded-xl p-6 relative overflow-visible ${className}`}>
      {hasHeader && (
        <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-3">
            {icon && <span className="text-white opacity-80">{icon}</span>}
            {title && (
              <h3 className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-mono">
                {title}
              </h3>
            )}
          </div>
          {headerAside && <div>{headerAside}</div>}
        </div>
      )}
      {children}
    </div>
  );
};