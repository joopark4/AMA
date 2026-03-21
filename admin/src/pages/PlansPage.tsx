import { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';

interface Plan {
  id: string;
  name: string;
  monthly_credit_limit: number;
  is_active: boolean;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', monthlyCredits: 0, isActive: true });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getPlans()
      .then((res) => setPlans(res.plans || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditForm({
      name: plan.name,
      monthlyCredits: plan.monthly_credit_limit,
      isActive: plan.is_active,
    });
    setSaveMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveMsg(null);
  };

  const handleSave = async (planId: string) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminApi.updatePlan(planId, {
        name: editForm.name,
        monthlyCredits: editForm.monthlyCredits,
        isActive: editForm.isActive,
      });
      const res = await adminApi.getPlans();
      setPlans(res.plans || []);
      setEditingId(null);
      setSaveMsg('Plan updated successfully');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-12">Loading plans...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load plans: {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Plans</h1>

      {saveMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm mb-4">
          {saveMsg}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monthly Credits
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {plans.map((plan) => {
              const isEditing = editingId === plan.id;
              return (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm w-full"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {plan.name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.monthlyCredits}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            monthlyCredits: Number(e.target.value),
                          }))
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm w-32"
                      />
                    ) : (
                      <span className="text-sm text-gray-700">
                        {plan.monthly_credit_limit.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, isActive: e.target.checked }))
                          }
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm">Active</span>
                      </label>
                    ) : (
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          plan.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleSave(plan.id)}
                          disabled={saving}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(plan)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
