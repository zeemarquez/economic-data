import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface TooltipProps {
    text: string;
    children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ref = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = useCallback(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setPos({ x: rect.left, y: rect.top });
        }
        setVisible(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setVisible(false);
    }, []);

    const tooltipEl = visible
        ? ReactDOM.createPortal(
            <div
                style={{
                    position: 'fixed',
                    top: pos.y - 8,
                    left: pos.x,
                    transform: 'translateY(-100%)',
                    zIndex: 99999,
                    width: '256px',
                    padding: '8px',
                    background: 'rgba(0,0,0,0.97)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    lineHeight: '1.4',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#d4d4d4',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    pointerEvents: 'none',
                    textTransform: 'none',
                    fontWeight: 400,
                    letterSpacing: 0,
                }}
            >
                {text}
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <span
                ref={ref}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'help' }}
            >
                {children}
            </span>
            {tooltipEl}
        </>
    );
};
