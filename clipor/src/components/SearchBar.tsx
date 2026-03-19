interface SearchBarProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function SearchBar({ value, placeholder, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default SearchBar;
