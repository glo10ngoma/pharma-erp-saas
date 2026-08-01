type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputId?: string;
};

export function SearchBox({ value, onChange, placeholder = 'Rechercher...', inputId }: Props) {
  return (
    <div className="search-box">
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </span>
      <input id={inputId} className="input" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
