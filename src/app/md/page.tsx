"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const telegramId = searchParams.get("tg_user") || "demo";
  const path = searchParams.get("path");

  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [sleep, setSleep] = useState("");
  const [water, setWater] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [habitDone, setHabitDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  // Check onboarding status
  useEffect(() => {
    if (!path) {
      router.push("/md/onboarding");
      return;
    }

    fetch(`/md/api/profile?telegramId=${telegramId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.onboardedAt) {
          router.push("/md/onboarding");
        } else {
          setOnboarded(true);
        }
      })
      .catch(() => setOnboarded(true))
      .finally(() => setLoading(false));
  }, [telegramId, path, router]);

  // Load today's check-in
  useEffect(() => {
    if (!onboarded) return;

    fetch(`/md/api/checkin?telegramId=${telegramId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.today) {
          setTodayLog(data.today);
          setSleep(data.today.sleepHours?.toString() || "");
          setWater(data.today.waterCups?.toString() || "");
          setMood(data.today.mood);
          setHabitDone(data.today.habitDone || false);
        }
      })
      .catch(() => {});
  }, [onboarded, telegramId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/md/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          sleepHours: sleep ? parseFloat(sleep) : null,
          waterCups: water ? parseInt(water) : null,
          mood,
          habitDone: habitDone || null,
        }),
      });

      const result = await res.json();
      if (result.error) {
        alert("Ошибка: " + result.error);
        setSaving(false);
        return;
      }

      // Load stats
      const statsRes = await fetch(`/md/api/stats?telegramId=${telegramId}`);
      const statsData = await statsRes.json();
      setStats(statsData);
      setSaved(true);
    } catch (err) {
      console.error("Check-in failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ fontSize: "18px", color: "var(--muted-foreground)" }}>Загрузка...</div>
      </div>
    );
  }

  if (!onboarded) return null;

  if (saved) {
    return (
      <SuccessView stats={stats} sleep={sleep} water={water} mood={mood} habitDone={habitDone} onClose={() => setSaved(false)} />
    );
  }

  return (
    <CheckInView
      sleep={sleep} setSleep={setSleep}
      water={water} setWater={setWater}
      mood={mood} setMood={setMood}
      habitDone={habitDone} setHabitDone={setHabitDone}
      saving={saving}
      onSubmit={handleSubmit}
    />
  );
}

function SuccessView({ stats, sleep, water, mood, habitDone, onClose }: any) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Отмечено!</h1>
      <p style={{ color: "var(--muted-foreground)", marginBottom: "24px" }}>Вы отметили сегодня:</p>
      <div className="card" style={{ textAlign: "left", marginBottom: "24px" }}>
        {sleep && <p style={{ margin: "8px 0" }}>☀️ Сон: {sleep} ч</p>}
        {water && <p style={{ margin: "8px 0" }}>💧 Вода: {water} стак.</p>}
        {mood !== null && (
          <p style={{ margin: "8px 0" }}>
            😊 Настроение: {"😢😕😐😊🤩"[mood - 1] || "😊"}
          </p>
        )}
        {habitDone && <p style={{ margin: "8px 0" }}>🏃 Привычка: ✅ Сделано</p>}
      </div>
      {stats && stats.streak > 0 && (
        <div className="card" style={{ background: "var(--secondary)", textAlign: "center" }}>
          <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>🔥 {stats.streak}</p>
          <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0" }}>дней подряд</p>
        </div>
      )}
      <button className="btn-primary" style={{ marginTop: "16px" }} onClick={onClose}>Закрыть</button>
    </div>
  );
}

function CheckInView({ sleep, setSleep, water, setWater, mood, setMood, habitDone, setHabitDone, saving, onSubmit }: any) {
  return (
    <div style={{ paddingBottom: "40px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>Доброе утро! ☀️</h1>
      <p style={{ color: "var(--muted-foreground)", marginBottom: "24px" }}>Отметьте свои показатели за сегодня</p>

      <form onSubmit={onSubmit}>
        <div className="card">
          <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "var(--muted-foreground)" }}>
            ☀️ Сон (часов)
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            className="input-field"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            placeholder="Например: 7.5"
          />

          <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", marginTop: "16px", color: "var(--muted-foreground)" }}>
            💧 Вода (стаканы)
          </label>
          <input
            type="number"
            min="0"
            max="30"
            className="input-field"
            value={water}
            onChange={(e) => setWater(e.target.value)}
            placeholder="Например: 8"
          />

          <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", marginTop: "16px", color: "var(--muted-foreground)" }}>
            😊 Настроение
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { emoji: "😢", val: 1, label: "Ужасно" },
              { emoji: "😕", val: 2, label: "Плохо" },
              { emoji: "😐", val: 3, label: "Нормально" },
              { emoji: "😊", val: 4, label: "Хорошо" },
              { emoji: "🤩", val: 5, label: "Отлично" },
            ].map((m) => (
              <button
                key={m.val}
                type="button"
                onClick={() => setMood(m.val)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  border: mood === m.val ? "2px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: mood === m.val ? "var(--secondary)" : "transparent",
                  cursor: "pointer",
                  fontSize: "20px",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ lineHeight: 1, marginBottom: "2px" }}>{m.emoji}</div>
                <div style={{ fontSize: "9px", color: "var(--muted-foreground)" }}>{m.label}</div>
              </button>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px", cursor: "pointer" }}>
            <div
              onClick={() => setHabitDone(!habitDone)}
              style={{
                width: "24px",
                height: "24px",
                border: habitDone ? "none" : "2px solid var(--border)",
                borderRadius: "6px",
                background: habitDone ? "var(--primary)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            >
              {habitDone && <span style={{ color: "white", fontSize: "14px", lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>🏃 Выполнить привычку сегодня</span>
          </label>
        </div>

        <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: "8px" }}>
          {saving ? "Сохранение..." : "✅ Отметить сегодня"}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <div className="md-container">
      <Suspense>
        <PageContent />
      </Suspense>
    </div>
  );
}
