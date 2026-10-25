import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Database,
  ExternalLink,
  Save,
  CheckCircle,
  AlertTriangle,
  Info,
  Server,
  Layers,
  BookOpen,
  Activity,
} from 'lucide-react';
import { getNlpStatus, healthCheck, getCourses, getAnalysisHistory, getCurricula } from '../services/api';
import { NlpStatus } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export const Settings: React.FC = () => {
  const [defaultThreshold, setDefaultThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('gap_default_threshold');
    return saved ? parseFloat(saved) : 0.6;
  });
  const [nlpStatus, setNlpStatus] = useState<NlpStatus | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [courseCount, setCourseCount] = useState<number>(0);
  const [analysisCount, setAnalysisCount] = useState<number>(0);
  const [curriculaCount, setCurriculaCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    setLoading(true);
    try {
      const [nlpRes, healthRes, coursesRes, historyRes, currRes] = await Promise.allSettled([
        getNlpStatus(),
        healthCheck(),
        getCourses(),
        getAnalysisHistory(),
        getCurricula(),
      ]);

      if (nlpRes.status === 'fulfilled') setNlpStatus(nlpRes.value.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
      if (coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value.data)) {
        setCourseCount(coursesRes.value.data.length);
      }
      if (historyRes.status === 'fulfilled' && Array.isArray(historyRes.value.data)) {
        setAnalysisCount(historyRes.value.data.length);
      }
      if (currRes.status === 'fulfilled' && Array.isArray(currRes.value.data)) {
        setCurriculaCount(currRes.value.data.length);
      }
    } catch (err: any) {
      console.error('Failed to load settings data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gap_default_threshold', defaultThreshold.toString());
    toast.success(`Default overlap threshold saved as ${(defaultThreshold * 100).toFixed(0)}%`);
  };

  if (loading) {
    return <LoadingSpinner size="lg" text="Querying backend telemetry and settings..." className="py-24" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Settings & Architecture</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure NLP pipeline parameters, inspect model inference telemetry, and view system specifications.
        </p>
      </div>

      {/* Analysis Defaults Card */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gray-100">
          <SettingsIcon className="w-4 h-4 text-indigo-600" />
          <h3 className="text-base font-bold text-gray-900">Analysis Threshold Configuration</h3>
        </div>

        <form onSubmit={handleSaveThreshold} className="space-y-4 max-w-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase">
                Default High-Overlap Flag Threshold
              </label>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded">
                {(defaultThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={defaultThreshold}
              onChange={(e) => setDefaultThreshold(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Pairs with pairwise cosine similarity exceeding this threshold will automatically be flagged as high-redundancy risks across dashboards and similarity runs.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Preference
          </button>
        </form>
      </div>

      {/* Database & System Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NLP Model Status */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gray-100">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">NLP Inference Pipeline</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">TF-IDF Vectorizer</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Operational
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Semantic Transformers</span>
              {nlpStatus?.semantic_available ? (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Ready
                </span>
              ) : (
                <span className="font-semibold text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> TF-IDF Fallback
                </span>
              )}
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Active Model</span>
              <span className="font-mono text-gray-800">
                {nlpStatus?.model_name || 'all-MiniLM-L6-v2 / Scikit-Learn'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500 font-medium">Device Execution</span>
              <span className="font-mono text-gray-800">{nlpStatus?.device || 'CPU'}</span>
            </div>
          </div>
        </div>

        {/* Database & Storage */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gray-100">
            <Database className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">Database & Records</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Total Courses Registered</span>
              <span className="font-bold text-gray-900 font-mono">{courseCount}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Analysis Audit Records</span>
              <span className="font-bold text-gray-900 font-mono">{analysisCount}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500 font-medium">Reference Curricula</span>
              <span className="font-bold text-gray-900 font-mono">{curriculaCount}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500 font-medium">Database Engine</span>
              <span className="font-mono text-gray-800">SQLite (Local Embedded)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Documentation */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <Server className="w-4 h-4 text-indigo-600" />
          <h3 className="text-base font-bold text-gray-900">Full-Stack System Architecture</h3>
        </div>

        {/* ASCII / Diagrammatic Layout */}
        <div className="bg-slate-900 text-slate-200 p-5 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed">
          <pre>{`┌───────────────────────────┐         REST API          ┌───────────────────────────┐
│       React Frontend      │◄─────────────────────────►│      FastAPI Backend      │
│  - TypeScript + Vite 6    │        (Port 8000)        │  - Python 3.10+           │
│  - Tailwind CSS v4        │                           │  - Scikit-Learn TF-IDF    │
│  - Recharts Visualizations│                           │  - Sentence Transformers  │
│  - Port 5173              │                           │  - SQLite Database        │
└───────────────────────────┘                           └───────────────────────────┘`}</pre>
        </div>

        {/* External Links */}
        <div className="flex items-center gap-4 flex-wrap pt-2">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <span>FastAPI Swagger Docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href="http://localhost:8000/redoc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            <span>ReDoc Specifications</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <span className="text-xs text-gray-400 ml-auto">
            Gap Analyzer v1.0.0 • Academic Edition
          </span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
