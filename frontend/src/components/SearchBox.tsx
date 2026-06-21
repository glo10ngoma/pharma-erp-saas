type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchBox({ value, onChange, placeholder = 'Rechercher...' }: Props) {
  return (
    <div className="search-box">
      <span aria-hidden="true">⌕</span>
      <input className="input" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
