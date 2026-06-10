"use client";

interface Props {
  percentage: number;
  forCount: number;
  againstCount: number;
  total: number;
}

export default function OpinionMeter({
  percentage,
  forCount,
  againstCount,
  total,
}: Props) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-green-600 font-medium">For · {forCount}</span>
        <span className="text-gray-500 text-xs">{total} votes</span>
        <span className="text-red-500 font-medium">
          Against · {againstCount}
        </span>
      </div>
      <div className="w-full h-3 bg-red-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
