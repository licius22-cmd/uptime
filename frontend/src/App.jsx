import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Clock, Mail, Trash2, Plus, RefreshCw, ServerOff, Loader2, Edit3, LineChart as LineChartIcon, X, AlertTriangle, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', url: '', interval: '1', email: '', alertThreshold: 1000, criticalThreshold: 2000
  });

  // Modals state
  const [editMonitor, setEditMonitor] = useState(null);
  const [historyModal, setHistoryModal] = useState({ isOpen: false, monitor: null, data: [], loading: false, timeframe: '1h' });

  const fetchMonitors = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/monitors`);
      setMonitors(data);
    } catch (error) {
      toast.error('Failed to load monitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
    const intervalId = setInterval(fetchMonitors, 10000); // Poll every 10s
    return () => clearInterval(intervalId);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editMonitor) {
        await axios.put(`${API_URL}/monitors/${editMonitor.id}`, formData);
        toast.success('Monitor updated successfully!');
        setEditMonitor(null);
      } else {
        await axios.post(`${API_URL}/monitors`, formData);
        toast.success('Monitor created successfully!');
      }
      setFormData({ name: '', url: '', interval: '1', email: '', alertThreshold: 1000, criticalThreshold: 2000 });
      fetchMonitors();
    } catch (error) {
      toast.error('Failed to save monitor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (monitor) => {
    setEditMonitor(monitor);
    setFormData({
      name: monitor.name || '',
      url: monitor.url,
      interval: monitor.interval.toString(),
      email: monitor.email,
      alertThreshold: monitor.alertThreshold || 1000,
      criticalThreshold: monitor.criticalThreshold || 2000
    });
    // Scroll to top for mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditMonitor(null);
    setFormData({ name: '', url: '', interval: '1', email: '', alertThreshold: 1000, criticalThreshold: 2000 });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this monitor?')) return;
    try {
      await axios.delete(`${API_URL}/monitors/${id}`);
      toast.success('Monitor deleted');
      fetchMonitors();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const openHistory = async (monitor, tf = '1h') => {
    setHistoryModal(prev => ({ ...prev, isOpen: true, monitor, data: [], loading: true, timeframe: tf }));
    try {
      const { data } = await axios.get(`${API_URL}/monitors/${monitor.id}/history?timeframe=${tf}`);
      // Format datetime for charts
      const formattedData = data.map(item => {
        const date = new Date(item.createdAt);
        // If > 12h or 1d show Day and Time, else just time
        const timeLabel = ['12h', '1d'].includes(tf)
          ? date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          ...item,
          timeLabel
        };
      });
      setHistoryModal({ isOpen: true, monitor, data: formattedData, loading: false, timeframe: tf });
    } catch (error) {
      toast.error('Failed to load history');
      setHistoryModal({ isOpen: false, monitor: null, data: [], loading: false, timeframe: tf });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'up':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Operational</span>;
      case 'down':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">Down</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans relative">
      <Toaster position="top-right" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } }} />

      {/* Navbar segment */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            <span className="text-zinc-100 font-semibold text-lg tracking-tight">uptime.</span>
          </div>
          <div className="text-sm text-zinc-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Systems Operational
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">

        {/* Left Col: Form */}
        <div className="md:w-1/3">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-xl sticky top-24">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
                {editMonitor ? <Edit3 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                {editMonitor ? 'Edit Monitor' : 'Add Monitor'}
              </h2>
              {editMonitor && (
                <button onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Monitor Name</label>
                <input
                  type="text" required
                  placeholder="e.g., Cartpanda Checkout"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Target URL</label>
                <input
                  type="url" required
                  placeholder="https://example.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Check Interval</label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors appearance-none"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  >
                    <option value="1">1 minute</option>
                    <option value="3">3 minutes</option>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center justify-between">
                  <span>Alert Email(s)</span>
                  <span className="text-xs text-zinc-600">Comma separated</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text" required
                    placeholder="alert@me.com, dev@me.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-amber-500/80 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Warning (ms)
                  </label>
                  <input
                    type="number" min="100" required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
                    value={formData.alertThreshold}
                    onChange={(e) => setFormData({ ...formData, alertThreshold: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-red-500/80 mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Critical (ms)
                  </label>
                  <input
                    type="number" min="200" required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 focus:outline-none focus:border-red-500/50 transition-colors text-sm"
                    value={formData.criticalThreshold}
                    onChange={(e) => setFormData({ ...formData, criticalThreshold: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={submitting}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editMonitor ? 'Save Changes' : 'Create Monitor'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Monitors List */}
        <div className="md:w-2/3">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400" /> Active Monitors
              </h2>
              <span className="text-xs text-zinc-500 font-medium bg-zinc-800 px-2 py-1 rounded-full">{monitors.length} Total</span>
            </div>

            <div className="p-0">
              {loading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : monitors.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
                  <ServerOff className="w-12 h-12 text-zinc-700 mb-3" />
                  <p>No active monitors. Add one to get started.</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {monitors.map((monitor) => (
                    <li key={monitor.id} className="p-6 hover:bg-zinc-800/50 transition-colors group">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                            {getStatusBadge(monitor.status)}
                            <span className="text-base font-medium text-zinc-100">{monitor.name}</span>
                            <a href={monitor.url} target="_blank" rel="noreferrer" className="text-sm font-normal text-zinc-500 hover:text-indigo-400 truncate max-w-sm transition-colors">
                              {monitor.url}
                            </a>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {monitor.interval}m</span>
                            <span className="flex items-center gap-1 truncate max-w-[200px]" title={monitor.email}><Mail className="w-3 h-3" /> {monitor.email}</span>
                            <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-500/50" /> &gt; {monitor.criticalThreshold || 2000}ms</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openHistory(monitor)}
                            className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                            title="View History"
                          >
                            <LineChartIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(monitor)}
                            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                            title="Edit Monitor"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(monitor.id)}
                            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                            title="Delete Monitor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* History Modal */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden mt-10 md:mt-0 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80 flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 truncate">
                <LineChartIcon className="w-5 h-5 text-indigo-400" />
                Response History <span className="text-zinc-500 font-normal text-sm block md:inline overflow-hidden text-ellipsis whitespace-nowrap hidden md:inline-block">({historyModal.monitor?.url})</span>
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-zinc-950 rounded-lg p-1 border border-zinc-800 text-xs font-medium">
                  {['5m', '10m', '30m', '1h', '6h', '12h', '1d'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => openHistory(historyModal.monitor, tf)}
                      disabled={historyModal.loading}
                      className={`px-2.5 py-1 rounded-md transition-colors ${historyModal.timeframe === tf ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'} disabled:opacity-50`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setHistoryModal({ isOpen: false, monitor: null, data: [], loading: false, timeframe: '1h' })}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors bg-zinc-950/50"
                  title="Close History"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {historyModal.loading ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                </div>
              ) : historyModal.data.length === 0 ? (
                <div className="py-20 text-center text-zinc-500">
                  <p>Not enough history yet. Please wait a few minutes.</p>
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyModal.data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis
                        dataKey="timeLabel"
                        stroke="#71717a"
                        fontSize={12}
                        tickMargin={10}
                        tick={{ fill: '#71717a' }}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={12}
                        tickFormatter={(val) => `${val}ms`}
                        tick={{ fill: '#71717a' }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#818cf8' }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="responseTime"
                        name="Response Time"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#818cf8', stroke: '#312e81', strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
