interface PlanBadgeProps {
  plan: string;
}

const planStyles: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
};

export default function PlanBadge({ plan }: PlanBadgeProps) {
  const style = planStyles[plan.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}>
      {plan}
    </span>
  );
}
