import { useState, useRef } from "react";

const suggestedHabits = [
  { icon: "💧", title: "Пить воду", desc: "8 стаканов в день" },
  { icon: "🏃", title: "Бег", desc: "30 минут активности" },
  { icon: "📖", title: "Чтение", desc: "20 страниц в день" },
  { icon: "🧘", title: "Медитация", desc: "10 минут спокойствия" },
  { icon: "💪", title: "Зарядка", desc: "Утренняя гимнастика" },
  { icon: "😴", title: "Сон до 23:00", desc: "Ложиться вовремя" },
];

export default function HabitStep({
  initialTitle = "Пить воду",
  onComplete,
  onBack,
}: {
  initialTitle?: string;
  onComplete: () => void;
  onBack?: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [selectedHabit, setSelectedHabit] = useState<{ icon: string; title: string } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const useSuggested = (h: { icon: string; title: string }) => {
    setSelectedHabit(h);
    setTitle(h.title);
  };

  return (
    <div>
      <div className="card">
        <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--muted-foreground)" }}>
          Какая одна привычка вас интересует?
        </label>
        <input
          ref={titleRef}
          type="text"
          className="input-field"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSelectedHabit(null); }}
          placeholder="Например: Медитация"
          maxLength={40}
        />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "8px", paddingLeft: "4px" }}>
          Или выберите готовую:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {suggestedHabits.map((h) => (
            <button
              key={h.title}
              onClick={() => useSuggested(h)}
              style={{
                padding: "8px 12px",
                border: selectedHabit?.title === h.title ? "2px solid var(--primary)" : "1px solid var(--border)",
                borderRadius: "20px",
                background: selectedHabit?.title === h.title ? "var(--secondary)" : "transparent",
                color: "inherit",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {h.icon} {h.title}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        {onBack && (
          <button
            className="input-field"
            onClick={onBack}
            style={{ flex: 1, textAlign: "center", cursor: "pointer", background: "transparent" }}
          >
            ← Назад
          </button>
        )}
        <button
          className="btn-primary"
          onClick={onComplete}
          disabled={!title.trim()}
          style={{ flex: 1 }}
        >
          🚀 Начать
        </button>
      </div>

      <p style={{ fontSize: "12px", color: "var(--muted-foreground)", textAlign: "center", marginTop: "12px" }}>
        Вы всегда сможете добавить другие привычки позже
      </p>
    </div>
  );
}
