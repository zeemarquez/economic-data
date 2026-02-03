import React from 'react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  className?: string;
}

export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  id,
  className = '',
}: SelectProps<T>) {
  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-widest text-neutral-500 font-mono pl-1"
      >
        {label}
      </label>
      <div className="relative group">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="
            w-full bg-neutral-900/50 border border-neutral-800 rounded-lg
            py-4 pl-4 pr-10
            text-lg font-mono text-white
            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50
            transition-all duration-300 shadow-inner
            appearance-none cursor-pointer
          "
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 1rem center',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
      </div>
    </div>
  );
}
