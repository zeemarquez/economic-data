import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

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
  /** Smaller control for dense toolbars (e.g. map filters). */
  compact?: boolean;
}

export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  id,
  className = '',
  compact = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setPosition(null);
    }
  }, [open]);

  const dropdownList = open && position && typeof document !== 'undefined' && (
    <ul
      ref={dropdownRef}
      role="listbox"
      className="
        fixed z-[9999] py-1
        bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl
        max-h-60 overflow-auto
      "
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
      aria-activedescendant={value}
    >
      {options.map((opt) => (
        <li
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          onClick={() => {
            onChange(opt.value);
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(opt.value);
              setOpen(false);
            }
          }}
            className={`
            px-4 ${compact ? 'py-1.5 text-[11px]' : 'py-3 text-sm'} text-left font-mono cursor-pointer
            transition-colors duration-150
            ${opt.value === value ? 'bg-neutral-800 text-white' : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white'}
          `}
        >
          {opt.label}
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={containerRef} className={`flex flex-col gap-2 w-full ${className}`}>
      <label
        htmlFor={id}
        className={`${compact ? 'text-[10px] tracking-[0.2em]' : 'text-xs tracking-widest'} uppercase text-neutral-500 font-mono pl-1`}
      >
        {label}
      </label>
      <div className="relative group">
        <button
          ref={buttonRef}
          type="button"
          id={id}
          onClick={() => setOpen((o) => !o)}
          className={`
            w-full bg-neutral-900/50 border border-neutral-800 rounded-lg text-left font-mono text-white
            focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50
            transition-all duration-300 shadow-inner
            cursor-pointer flex items-center justify-between
            ${compact ? 'h-8 min-h-8 px-2.5 text-xs' : 'py-4 pl-4 pr-4 text-lg'}
          `}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={id ? `${id}-label` : undefined}
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronDown
            className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-neutral-400 shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
      </div>
      {dropdownList && createPortal(dropdownList, document.body)}
    </div>
  );
}
