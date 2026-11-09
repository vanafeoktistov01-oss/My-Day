"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TimezoneStep from "./components/timezone-step";
import ReminderStep from "./components/reminder-step";
import HabitStep from "./components/habit-step";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const telegramId = searchParams.get("tg_user") || "demo";
  const [step, setStep] = useState(1);
  const [timezone, setTimezone] = useState("Europe/Moscow");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [habitTitle, setHabitTitle] = useState("Пить воду");

  const handleComplete = async () => {
    try {
      // 1. Создаём/обновляем профиль
      await fetch("/md/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          timezone,
          reminderTime,
        }),
      });

      // 2. Создаём привычку
      await fetch("/md/api/habit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          title: habitTitle,
          icon: "💧",
        }),
      });

      // 3. Редирект на чек-ин
      router.push(`/md?tg_user=${telegramId}&path=checkin`);
    } catch (err) {
      console.error("Onboarding failed:", err);
      // Fallback — редирект на чек-ин
      router.push(`/md?tg_user=${telegramId}&path=checkin`);
    }
  };

  const handleTimezoneSelect = (tz: string) => {
    setTimezone(tz);
    setStep(2);
  };

  const handleReminderSelect = (time: string) => {
    setReminderTime(time);
    setStep(3);
  };

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* Step indicator */}
      <div className="step-dots">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`step-dot ${step >= s ? "active" : ""}`}
          />
        ))}
      </div>

      <h1
        style={{
          fontSize: "22px",
          fontWeight: 700,
          marginBottom: "4px",
          textAlign: "center",
        }}
      >
        {step === 1
          ? "Куда вы живёте? 🌍"
          : step === 2
            ? "Когда напомнить? ⏰"
            : "Что отслеживать? 🎯"}
      </h1>
      <p
        style={{
          color: "var(--muted-foreground)",
          textAlign: "center",
          marginBottom: "24px",
          fontSize: "14px",
        }}
      >
        {step === 1
          ? "Чтобы напоминания приходили в нужное время"
          : step === 2
            ? "Мы напомним отметить день"
            : "Начните с одной привычки — добавите позже"}
      </p>

      {step === 1 && (
        <TimezoneStep
          onSelect={handleTimezoneSelect}
        />
      )}

      {step === 2 && (
        <ReminderStep
          initialTime={reminderTime}
          onSelect={handleReminderSelect}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <HabitStep
          initialTitle={habitTitle}
          onComplete={handleComplete}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
