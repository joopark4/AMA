interface QuotaBarProps {
  used: number;
  limit: number;
  label?: string;
}

export default function QuotaBar({ used, limit, label }: QuotaBarProps) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor =
    percentage >= 100
      ? 'bg-red-500'
      : percentage >= 80
        ? 'bg-yellow-500'
        : 'bg-blue-500';

  return (
    <div>
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">{label}</span>
          <span className="text-gray-500">
            {used.toLocaleString()} / {limit.toLocaleString()} ({percentage.toFixed(1)}%)
          </span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
