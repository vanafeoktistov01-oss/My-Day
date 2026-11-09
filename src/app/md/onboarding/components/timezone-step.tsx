export const timezones = [
  { label: "Москва (UTC+3)", value: "Europe/Moscow" },
  { label: "Самара (UTC+4)", value: "Asia/Samara" },
  { label: "Екатеринбург (UTC+5)", value: "Asia/Yekaterinburg" },
  { label: "Омск (UTC+6)", value: "Asia/Omsk" },
  { label: "Красноярск (UTC+7)", value: "Asia/Krasnoyarsk" },
  { label: "Новосибирск (UTC+7)", value: "Asia/Novosibirsk" },
  { label: "Иркутск (UTC+8)", value: "Asia/Irkutsk" },
  { label: "Чита (UTC+8)", value: "Asia/Chita" },
  { label: "Хабаровск (UTC+10)", value: "Asia/Sakhalin" },
  { label: "Владивосток (UTC+10)", value: "Asia/Vladivostok" },
  { label: "Сеул (UTC+9)", value: "Asia/Seoul" },
  { label: "Токио (UTC+9)", value: "Asia/Tokyo" },
  { label: "Шанхай (UTC+8)", value: "Asia/Shanghai" },
  { label: "Сингапур (UTC+8)", value: "Asia/Singapore" },
  { label: "Дубай (UTC+4)", value: "Asia/Dubai" },
  { label: "Лондон (UTC+0)", value: "Europe/London" },
  { label: "Нью-Йорк (UTC-5)", value: "America/New_York" },
  { label: "Лос-Анджелес (UTC-8)", value: "America/Los_Angeles" },
  { label: "Берлин (UTC+1)", value: "Europe/Berlin" },
  { label: "Париж (UTC+1)", value: "Europe/Paris" },
] as const;

import { useState, useEffect, useRef } from "react";

export default function TimezoneStep({
  onSelect,
}: {
  onSelect: (tz: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = timezones.filter((tz) =>
    tz.label.toLowerCase().includes(query.toLowerCase()) ||
    tz.value.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="card" style={{ padding: "12px" }}>
      <input
        ref={inputRef}
        type="text"
        className="input-field"
        placeholder="Поиск..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: "12px" }}
      />
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {filtered.map((tz) => (
          <button
            key={tz.value}
            onClick={() => onSelect(tz.value)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 8px",
              border: "none",
              borderBottom: "1px solid var(--border)",
              background: "transparent",
              color: "inherit",
              fontSize: "15px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontWeight: 600, minWidth: "120px" }}>
              {tz.label}
            </span>
            <span style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>
              {tz.value}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
