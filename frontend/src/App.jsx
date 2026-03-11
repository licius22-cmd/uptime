import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Clock, Mail, Trash2, Plus, RefreshCw, ServerOff, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ url: '', interval: '1', email: '' });

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
      await axios.post(`${API_URL}/monitors`, formData);
      toast.success('Monitor created successfully!');
      setFormData({ url: '', interval: '1', email: '' });
      fetchMonitors();
    } catch (error) {
      toast.error('Failed to create monitor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/monitors/${id}`);
      toast.success('Monitor deleted');
      fetchMonitors();
    } catch (error) {
      toast.error('Failed to delete');
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
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans">
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

      <main className="max-w-5xl mx-auto px-4 py-12 flex flex-col md:flex-row gap-8">

        {/* Left Col: Form */}
        <div className="md:w-1/3">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-zinc-100 mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Add Monitor
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <label className="block text-sm font-medium text-zinc-400 mb-1">Alert Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email" required
                    placeholder="alert@me.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Monitor'}
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
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-3 mb-1">
                            {getStatusBadge(monitor.status)}
                            <a href={monitor.url} target="_blank" rel="noreferrer" className="text-base font-medium text-zinc-200 hover:text-indigo-400 truncate transition-colors">
                              {monitor.url}
                            </a>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Every {monitor.interval}m</span>
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {monitor.email}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(monitor.id)}
                          className="p-2 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Monitor"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
