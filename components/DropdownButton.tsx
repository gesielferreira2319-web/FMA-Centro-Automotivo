import React, { useState, useRef, useEffect } from 'react';

interface Option {
    label: string;
    onClick: () => void;
    icon?: string;
}

interface DropdownButtonProps {
    label: string;
    icon: string;
    colorClass: string; // e.g. 'bg-slate-600 hover:bg-slate-700'
    textColorClass?: string; // e.g. 'text-white'
    options: Option[];
    placement?: 'top' | 'bottom';
}

export function DropdownButton({ label, icon, colorClass, textColorClass = 'text-white', options, placement = 'bottom' }: DropdownButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg ${colorClass} ${textColorClass}`}
            >
                <span className="material-icons-round text-lg">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
                <span className="material-icons-round text-sm ml-1 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    expand_more
                </span>
            </button>

            {isOpen && (
                <div
                    className={`absolute right-0 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in duration-200 ${placement === 'top'
                            ? 'bottom-full mb-2 slide-in-from-bottom-2 origin-bottom-right'
                            : 'top-full mt-2 slide-in-from-top-2 origin-top-right'
                        }`}
                >
                    <div className="py-1">
                        {options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    option.onClick();
                                    setIsOpen(false);
                                }}
                                className="flex items-center w-full px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left gap-2 transition-colors"
                                role="menuitem"
                            >
                                {option.icon && (
                                    <span className="material-icons-round text-slate-400 text-lg">{option.icon}</span>
                                )}
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
