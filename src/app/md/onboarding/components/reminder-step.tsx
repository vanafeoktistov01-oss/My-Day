import { useState, useEffect, useRef } from "react";

const defaultTimes = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00",
];

export default function ReminderStep({
  initialTime = "09:00",
  onSelect,
  onBack,
}: {
  initialTime?: string;
  onSelect: (time: string) => void;
  onBack?: () => void;
}) {
  const [selected, setSelected] = useState(initialTime);
  const timeRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    timeRef.current?.focus();
  }, []);

  return (
    <div>
      <div className="card" style={{ textAlign: "center", padding: "24px 12px" }}>
        <div
          style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "var(--primary)",
            fontFamily: "monospace",
            marginBottom: "4px",
          }}
        >
          {selected}
        </div>
        <div style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>
          Будем напоминать в это время
        </div>
      </div>

      <div className="card" style={{ padding: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          {defaultTimes.map((time) => {
            const h = parseInt(time.split(":")[0]);
            const isMorning = h >= 6 && h < 12;
            const isAfternoon = h >= 12 && h < 17;
            const isEvening = h >= 17 && h < 21;

            return (
              <button
                key={time}
                onClick={() => setSelected(time)}
                style={{
                  padding: "10px 4px",
                  border: selected === time ? "2px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "8px",
                  background:
                    selected === time
                      ? "var(--secondary)"
                      : "transparent",
                  color: "inherit",
                  fontSize: "14px",
                  fontWeight: selected === time ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  transition: "all 0.2s",
                }}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        {onBack && (
          <button
            className="input-field"
            onClick={onBack}
            style={{
              flex: 1,
              textAlign: "center",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            ← Назад
          </button>
        )}
        <button
          className="btn-primary"
          onClick={() => onSelect(selected)}
          style={{ flex: 1 }}
        >
          Далее →
        </button>
      </div>
    </div>
  );
}
