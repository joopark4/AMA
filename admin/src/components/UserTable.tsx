import { useNavigate } from 'react-router-dom';
import PlanBadge from './PlanBadge';

interface UserRow {
  id: string;
  email: string;
  nickname: string | null;
  plan_id?: string;
  plan_name?: string;
  planId?: string;
  credits_used?: number;
  credit_limit?: number;
  monthlyUsed?: number;
  totalSeconds?: number;
}

interface UserTableProps {
  users: UserRow[];
  loading?: boolean;
}

export default function UserTable({ users, loading }: UserTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        Loading users...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No users found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nickname
            </th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Plan
            </th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Usage
            </th>
            <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => {
            const planLabel = user.plan_name ?? user.planId ?? user.plan_id ?? 'free';
            const used = user.credits_used ?? user.monthlyUsed ?? user.totalSeconds ?? 0;
            const limit = user.credit_limit ?? 0;
            const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
            return (
              <tr
                key={user.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/users/${user.id}`)}
              >
                <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.nickname || '-'}
                </td>
                <td className="px-6 py-4">
                  <PlanBadge plan={planLabel} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {used.toLocaleString()}{limit > 0 ? ` / ${limit.toLocaleString()}` : ''}{' '}
                  {limit > 0 && <span className="text-gray-400">({pct}%)</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/users/${user.id}`);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
