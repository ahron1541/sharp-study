import { useState, useEffect } from 'react';
import { Users, FileText, Shield, Trash2, Ban, BarChart2 } from 'lucide-react';
import Navbar from '../../../shared/components/Navbar';
import Button from '../../../shared/components/Button';
import Modal from '../../../shared/components/Modal';
import SkeletonCard from '../../../shared/components/SkeletonCard';
import { apiRequest } from '../../../config/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'users',   label: 'Users',   icon: <Users size={16} /> },
  { id: 'content', label: 'Content', icon: <FileText size={16} /> },
  { id: 'stats',   label: 'Stats',   icon: <BarChart2 size={16} /> },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState(null);

  useEffect(() => {
    if (tab === 'users') {
      setLoading(true);
      apiRequest('/api/admin/users')
        .then((data) => { setUsers(data.users); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [tab]);

  const confirmAction = (user, type) => {
    setActionTarget(user);
    setActionType(type); // 'block' | 'unblock' | 'delete'
  };

  const executeAction = async () => {
    try {
      if (actionType === 'delete') {
        await apiRequest(`/api/admin/users/${actionTarget.id}`, { method: 'DELETE' });
        setUsers((u) => u.filter((x) => x.id !== actionTarget.id));
        toast.success('User deleted.');
      } else {
        const blocked = actionType === 'block';
        await apiRequest(`/api/admin/users/${actionTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_blocked: blocked }),
        });
        setUsers((u) =>
          u.map((x) => x.id === actionTarget.id ? { ...x, is_blocked: blocked } : x)
        );
        toast.success(blocked ? 'User blocked.' : 'User unblocked.');
      }
    } catch {
      toast.error('Action failed.');
    }
    setActionTarget(null);
  };

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="text-[var(--accent)]" size={28} />
          <h1 className="text-2xl font-bold text-[var(--text-color)]">Admin Dashboard</h1>
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 mb-6 border-b border-[var(--card-border)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                         ${tab === t.id
                           ? 'border-[var(--accent)] text-[var(--accent)]'
                           : 'border-transparent text-[var(--muted)] hover:text-[var(--text-color)]'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-[var(--text-color)]">
                All Users ({users.length})
              </h2>
            </div>
            {loading ? (
              <div className="p-4 grid gap-3">
                {[1,2,3,4].map((n) => <SkeletonCard key={n} />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  role="table"
                  className="w-full text-sm"
                  aria-label="User management table"
                >
                  <thead>
                    <tr className="border-b border-[var(--card-border)] bg-[var(--bg-color)]">
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--muted)]">
                        Name
                      </th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--muted)]">
                        Email
                      </th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--muted)]">
                        Role
                      </th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--muted)]">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--muted)]">
                        Joined
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold text-[var(--muted)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-[var(--card-border)] hover:bg-[var(--bg-color)]"
                      >
                        <td className="px-4 py-3 text-[var(--text-color)] font-medium">{u.full_name}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                          ${u.role === 'admin'
                                            ? 'bg-purple-500/10 text-purple-500'
                                            : 'bg-blue-500/10 text-blue-500'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                          ${u.is_blocked
                                            ? 'bg-red-500/10 text-red-500'
                                            : 'bg-green-500/10 text-green-500'}`}>
                            {u.is_blocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {u.role !== 'admin' && (
                              <>
                                <Button
                                  size="sm"
                                  variant={u.is_blocked ? 'secondary' : 'secondary'}
                                  icon={<Ban size={14} />}
                                  onClick={() => confirmAction(u, u.is_blocked ? 'unblock' : 'block')}
                                  ariaLabel={u.is_blocked ? `Unblock ${u.full_name}` : `Block ${u.full_name}`}
                                >
                                  {u.is_blocked ? 'Unblock' : 'Block'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  icon={<Trash2 size={14} />}
                                  onClick={() => confirmAction(u, 'delete')}
                                  ariaLabel={`Delete ${u.full_name}`}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Stats tab */}
        {tab === 'stats' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', icon: '👥', value: users.length },
              { label: 'Active', icon: '✅', value: users.filter((u) => !u.is_blocked).length },
              { label: 'Blocked', icon: '🚫', value: users.filter((u) => u.is_blocked).length },
              { label: 'Admins', icon: '🛡️', value: users.filter((u) => u.role === 'admin').length },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6"
              >
                <div className="text-3xl mb-2" aria-hidden="true">{s.icon}</div>
                <p className="text-2xl font-bold text-[var(--text-color)]">{s.value}</p>
                <p className="text-sm text-[var(--muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirm action modal */}
      <Modal
        isOpen={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={`${actionType === 'delete' ? '⚠️ Delete' : actionType === 'block' ? '🚫 Block' : '✅ Unblock'} User`}
        size="sm"
      >
        <p className="text-[var(--text-color)] mb-4">
          Are you sure you want to{' '}
          <strong>{actionType}</strong> the account of{' '}
          <strong>{actionTarget?.full_name}</strong>?
          {actionType === 'delete' && ' This cannot be undone.'}
        </p>
        <div className="flex gap-2">
          <Button variant={actionType === 'delete' ? 'danger' : 'primary'} onClick={executeAction}>
            Confirm
          </Button>
          <Button variant="secondary" onClick={() => setActionTarget(null)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}