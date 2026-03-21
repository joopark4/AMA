interface DayData {
  date: string;
  count: number;
}

interface UsageChartProps {
  data: DayData[];
  label?: string;
}

export default function UsageChart({ data, label }: UsageChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      {label && <h3 className="text-sm font-medium text-gray-700 mb-3">{label}</h3>}
      <div className="flex items-end gap-1 h-40">
        {data.map((day) => {
          const height = (day.count / maxCount) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center justify-end group"
            >
              <div className="relative w-full">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                  {day.count.toLocaleString()}
                </div>
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors min-h-[2px]"
                  style={{ height: `${Math.max(height, 1.5)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">
                {day.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
