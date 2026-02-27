import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Dropdown({ value, options, onChange, ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listboxId = useId();

  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const openMenu = () => {
    setOpen(true);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const closeMenu = () => setOpen(false);

  const selectAtIndex = (index) => {
    if (index < 0 || index >= options.length) return;
    onChange(options[index].value);
    closeMenu();
    buttonRef.current?.focus();
  };

  const onTriggerKeyDown = (event) => {
    if (event.key === 'Tab') {
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        selectAtIndex(highlightedIndex >= 0 ? highlightedIndex : selectedIndex);
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onKeyDown={onTriggerKeyDown}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        className="dropdown-trigger w-full min-w-[152px] rounded-xl px-3 py-2 text-left text-sm text-indigo-50 transition active:scale-[0.99] active:opacity-90"
      >
        <span className="pr-6">{selectedOption?.label}</span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-indigo-100/80 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className="dropdown-menu absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-white/15 bg-[rgba(14,20,52,0.78)] shadow-[0_12px_34px_rgba(2,6,24,0.45)] backdrop-blur-xl"
        >
          <ul id={listboxId} role="listbox" aria-label={ariaLabel} className="no-scrollbar max-h-56 overflow-y-auto p-1">
            {options.map((option, index) => {
              const selected = option.value === value;
              const highlighted = index === highlightedIndex;
              return (
                <li key={option.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectAtIndex(index)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition active:scale-[0.99] active:opacity-90 ${
                      selected
                        ? 'bg-indigo-400/30 text-indigo-50 shadow-[inset_0_0_0_1px_rgba(199,210,254,0.22)]'
                        : highlighted
                        ? 'bg-white/12 text-indigo-50'
                        : 'text-indigo-100/90'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
