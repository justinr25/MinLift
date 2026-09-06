import { useState, useEffect } from "react";
import { useActiveWorkoutStore } from "../stores/active-workout-store";

export function useWorkoutTimer() {
  const startTime = useActiveWorkoutStore((s) => s.startTime);
  const isActive = useActiveWorkoutStore((s) => s.isActive);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diffInSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diffInSeconds);
    };

    updateTimer(); // Initial sync
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const formatTimer = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  return {
    elapsedSeconds,
    formattedTime: formatTimer(elapsedSeconds),
  };
}
