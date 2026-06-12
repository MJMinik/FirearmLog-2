// A text field that suggests your own past entries as you type — tap the
// field and recent values appear; type a letter and the list narrows.
// One shared component (DRY) so any form can use it.
import { useState } from 'react';
import { rankSuggestions } from '../lib/suggest.ts';

export function SuggestField({ label, value, onChange, suggestions, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = open ? rankSuggestions(suggestions, value) : [];
  return (
    <label className="field suggest-anchor">{label}
      <input value={value} placeholder={placeholder}
        autoComplete="off" autoCorrect="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)} />
      {matches.length > 0 && (
        <div className="suggest-list" role="listbox" aria-label={`${label} suggestions`}>
          {matches.map((v) => (
            <button key={v} type="button" className="suggest-row" role="option" aria-selected={false}
              // preventDefault keeps the input focused so onBlur can't eat the tap
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(v); setOpen(false); }}>
              {v}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
