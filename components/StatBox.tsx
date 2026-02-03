import React from 'react';

interface StatBoxProps {
  label: string;
  value: number;
  subValue?: string;
  highlight?: boolean;
  color?: string;
  suffix?: string;
  formatter?: (value: number) => string;
}

export const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  subValue,
  highlight,
  color = "text-white",
  suffix = "€",
  formatter,
}) => {
  const formattedValue = formatter
    ? formatter(value)
    : value.toLocaleString('es-ES', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
        useGrouping: true,
      });

  return (
    <div className="flex flex-col">
      <span className="text-neutral-500 text-xs font-mono uppercase tracking-wider mb-1">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono tracking-tight ${color}`}>
          {formattedValue}
          {suffix}
        </span>
        {highlight && <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>}
      </div>
      {subValue && (
        <span className="text-neutral-600 text-xs font-mono mt-1">{subValue}</span>
      )}
    </div>
  );
};