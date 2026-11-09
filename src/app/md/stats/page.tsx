"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const moodEmojis = ["😢", "😕", "😐", "😊", "🤩"];

function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
      <div style={{ fontSize: "18px", color: "var(--muted-foreground)" }}>Загрузка...</div>
    </div>
  );
}

// Stats content — wrapped in a separate component for Suspense
function StatsInner() {
  const searchParams = useSearchParams();
  const telegramId = searchParams.get("tg_user") || "demo";
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "insights">("stats");

  useEffect(() => {
    fetch(`/md/api/stats?telegramId=${telegramId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [telegramId]);

  if (loading) return <Loading />;

  return (
    <div style={{ paddingBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>Статистика</h1>
        <Link
          href={`/md?tg_user=${telegramId}&path=checkin`}
          style={{ color: "var(--primary)", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}
        >
          + Отметить
        </Link>
      </div>

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "var(--muted)", borderRadius: "10px", padding: "3px" }}>
        {(["stats", "insights"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderRadius: "8px",
              background: activeTab === tab ? "var(--card)" : "transparent",
              color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {tab === "stats" ? "📊 Статистика" : "💡 Инсайты"}
          </button>
        ))}
      </div>

      {activeTab === "stats" && (
        <>
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, var(--primary), #8B83FF)",
              color: "white",
              textAlign: "center",
              padding: "28px",
            }}
          >
            <div style={{ fontSize: "48px", fontWeight: 700, marginBottom: "4px" }}>
              🔥 {stats?.streak || 0}
            </div>
            <div style={{ fontSize: "14px", opacity: 0.85 }}>дней подряд</div>
            {stats?.maxStreak > stats?.streak && (
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "8px" }}>
                Рекорд: {stats!.maxStreak}
              </div>
            )}
          </div>

          {(stats?.avgSleep || stats?.avgWater || stats?.avgMood) && (
            <div className="card">
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "12px" }}>
                Средние значения
              </div>
              <div className="grid-3">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary)" }}>
                    {stats.avgSleep || "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>☀️ Часов сна</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary)" }}>
                    {stats.avgWater || "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>💧 Стаканов воды</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary)" }}>
                    {stats.avgMood ? moodEmojis[Math.round(stats.avgMood) - 1] : "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>😊 Настроение</div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "12px" }}>
              Последние 30 дней
            </div>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {(stats?.heatmap || []).map((day: any, i: number) => (
                <div
                  key={i}
                  className="heatmap-cell"
                  style={{
                    background: day.completed
                      ? `hsl(246, 75%, ${45 + (i % 3) * 5}%)`
                      : "var(--muted)",
                    opacity: day.completed ? 1 : 0.4,
                  }}
                  title={`${day.date}: ${day.completed ? "Отмечено" : "Пропущено"}`}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "var(--muted-foreground)" }}>
              <span>30 дн. назад</span>
              <span>Сегодня</span>
            </div>
          </div>

          {stats?.habits?.length > 0 && (
            <div className="card">
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "12px" }}>
                Привычки
              </div>
              {stats.habits.map((habit: any) => (
                <div key={habit.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "20px" }}>{habit.icon || "🏃"}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{habit.title}</span>
                  <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                    {habit.isActive ? "Активна" : "Неактивна"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {stats?.totalLogs && (
            <div style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: "13px" }}>
              Всего записей: {stats.totalLogs}
            </div>
          )}
        </>
      )}

      {activeTab === "insights" && <InsightsTab telegramId={telegramId} />}
    </div>
  );
}

function InsightsTab({ telegramId }: { telegramId: string }) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/md/api/insights?telegramId=${telegramId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setInsights(data.insights || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [telegramId]);

  if (loading) return <Loading />;

  if (insights.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>💡</div>
        <p style={{ color: "var(--muted-foreground)", margin: 0 }}>
          Пока нет инсайтов. Отмечайте дни регулярно — и мы найдём закономерности!
        </p>
      </div>
    );
  }

  return (
    <div>
      {insights.map((insight: any, i: number) => (
        <div key={i} className="card" style={{ borderLeft: "3px solid var(--primary)" }}>
          <div style={{ fontSize: "14px", lineHeight: 1.6 }}>{insight.message}</div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <div className="md-container">
      <Suspense fallback={<Loading />}>
        <StatsInner />
      </Suspense>
    </div>
  );
}
