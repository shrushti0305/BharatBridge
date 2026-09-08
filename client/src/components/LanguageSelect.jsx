import React from "react";

export default function LanguageSelect({ id, languages, value, onChange, disabled }) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label} · {l.native}
        </option>
      ))}
    </select>
  );
}
