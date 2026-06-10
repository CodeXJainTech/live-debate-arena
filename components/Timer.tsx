import { useEffect, useState } from "react";

interface Props {
  endsAt: number | null;
  label?: string;
}

export default function Timer({ endsAt, label }: Props) {
  const [secondLeft, setSecondLeft] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => {
      setSecondLeft(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  });

  const mins = Math.floor(secondLeft / 60);
  const secs = secondLeft % 60;
  const showing = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const showRed = secondLeft <= 30;

  return (
    <span
      className={`text-sm font-mono ${showRed ? "text-red-500" : "text-gray-600"}`}
    >
      {label && <span className="mr-1">{label}</span>}
      {showing}
    </span>
  );
}
