import { KeyboardEvent, MutableRefObject, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Column<T> = {
  header: string;
  render: (item: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  dataGridCell?: string;
  emptyText?: string;
  footerLabel?: string;
  getKey: (item: T) => string;
  inputClassName?: string;
  inputRef?: MutableRefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onClose: () => void;
  onFallbackKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  onFocusNext?: () => void;
  onOpen: () => void;
  onSelect: (item: T) => void;
  open: boolean;
  placeholder: string;
  searchPlaceholder: string;
  suggestions: T[];
  value: string;
};

export function FloatingSearchPopover<T>({
  columns,
  dataGridCell,
  emptyText = 'Aucun resultat trouve',
  footerLabel = 'Haut/Bas pour naviguer - Entree pour selectionner - Echap pour fermer',
  getKey,
  inputClassName = 'input compact-input',
  inputRef: externalInputRef,
  onChange,
  onClose,
  onFallbackKeyDown,
  onFocusNext,
  onOpen,
  onSelect,
  open,
  placeholder,
  searchPlaceholder,
  suggestions,
  value,
}: Props<T>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 700 });
  const visibleSuggestions = suggestions.slice(0, 20);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(0);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(720, Math.max(650, window.innerWidth - 32));
      const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16));
      setPosition({ left, top: rect.bottom + 6, width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose, open]);

  const choose = (item: T) => {
    onSelect(item);
    onClose();
    setTimeout(() => onFocusNext?.(), 0);
  };

  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown' && open) {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(visibleSuggestions.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp' && open) {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && visibleSuggestions[highlightedIndex]) {
      event.preventDefault();
      choose(visibleSuggestions[highlightedIndex]);
      return;
    }
    onFallbackKeyDown?.(event);
  };

  return <>
    <input
      ref={(node) => {
        inputRef.current = node;
        if (externalInputRef) externalInputRef.current = node;
      }}
      className={inputClassName}
      data-grid-cell={dataGridCell}
      placeholder={placeholder}
      value={value}
      onClick={onOpen}
      onFocus={onOpen}
      onMouseDown={onOpen}
      onKeyDown={handleKeys}
      onChange={(event) => { onOpen(); onChange(event.target.value); }}
      onInput={(event) => { onOpen(); onChange(event.currentTarget.value); }}
    />
    {open && createPortal(
      <div ref={popoverRef} className="article-popover floating-article-popover" style={{ left: position.left, top: position.top, width: position.width }}>
        <input
          className="input compact-input article-popover-search"
          placeholder={searchPlaceholder}
          value={value}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeys}
        />
        <div className="article-popover-list">
          <div className="article-popover-head">{columns.map((column) => <span key={column.header}>{column.header}</span>)}</div>
          {visibleSuggestions.length === 0 && <div className="article-popover-empty">{emptyText}</div>}
          {visibleSuggestions.map((suggestion, index) => <button className={`article-popover-option ${index === highlightedIndex ? 'selected' : ''}`} type="button" key={getKey(suggestion)} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => choose(suggestion)}>
            {columns.map((column) => <span key={column.header}>{column.render(suggestion)}</span>)}
          </button>)}
        </div>
        <div className="article-popover-footer"><span>{footerLabel}</span><strong>{visibleSuggestions.length ? `1 - ${visibleSuggestions.length} sur ${suggestions.length}` : `0 sur ${suggestions.length}`}</strong></div>
      </div>,
      document.body,
    )}
  </>;
}
