import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History as HistoryIcon,
  GitCompare,
  Target,
  Trash2,
  Eye,
  FileSpreadsheet,
  Sparkles,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  getAnalysisHistory,
  getAnalysisById,
  deleteAnalysis,
  exportAnalysis,
} from '../services/api';
import { AnalysisHistoryItem } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AnalysisHistoryItem | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await getAnalysisHistory();
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch history', err);
      toast.error('Failed to load analysis history');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await getAnalysisById(id);
      setSelectedAnalysis(res.data);
    } catch (err: any) {
      console.error('Failed to load analysis details', err);
      toast.error('Could not load detailed analysis');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDeleteAnalysis = async () => {
    if (!itemToDelete) return;
    try {
      await deleteAnalysis(itemToDelete.id);
      toast.success(`Analysis #${itemToDelete.id} deleted`);
      setItemToDelete(null);
      fetchHistory();
    } catch (err: any) {
      console.error('Error deleting analysis', err);
      toast.error(err.response?.data?.detail || 'Failed to delete analysis');
    }
  };

  const handleExport = async (id: number) => {
    const toastId = toast.loading('Exporting analysis CSV...');
    try {
      const res = await exportAnalysis(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analysis_${id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Analysis exported successfully', { id: toastId });
    } catch (err: any) {
      console.error('Export failed', err);
      toast.error('Export failed', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analysis History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse and inspect previous similarity runs, curriculum audits, and generated metrics.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" text="Loading past analyses..." className="py-24" />
      ) : history.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID & Date</th>
                  <th className="py-3.5 px-4">Analysis Type</th>
                  <th className="py-3.5 px-4">NLP Method</th>
                  <th className="py-3.5 px-4">Parameters</th>
                  <th className="py-3.5 px-4">Summary</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {history.map((item) => {
                  const dateStr = new Date(item.created_at).toLocaleString();
                  const isSimilarity = item.analysis_type === 'similarity' || (item as any).type === 'similarity';

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-gray-900">#{item.id}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isSimilarity
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}
                        >
                          {isSimilarity ? (
                            <GitCompare className="w-3.5 h-3.5" />
                          ) : (
                            <Target className="w-3.5 h-3.5" />
                          )}
                          <span className="capitalize">{item.analysis_type || 'Similarity'}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="text-xs font-semibold font-mono uppercase px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                          {item.method || 'TF-IDF'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-gray-600">
                        {item.parameters ? (
                          <div className="space-y-0.5 font-mono text-[11px]">
                            {item.parameters.threshold !== undefined && (
                              <div>Threshold: {(item.parameters.threshold * 100).toFixed(0)}%</div>
                            )}
                            {item.parameters.curriculum_id && (
                              <div>Curriculum: #{item.parameters.curriculum_id}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs text-gray-600 max-w-xs">
                        {typeof item.summary === 'string' ? (
                          <span className="line-clamp-2">{item.summary}</span>
                        ) : item.summary ? (
                          <div className="space-y-0.5 text-[11px]">
                            {item.summary.high_overlap_count !== undefined && (
                              <div className="text-rose-600 font-semibold">
                                {item.summary.high_overlap_count} high-overlap pairs
                              </div>
                            )}
                            {item.summary.coverage_percentage !== undefined && (
                              <div className="text-emerald-600 font-semibold">
                                {item.summary.coverage_percentage}% curriculum coverage
                              </div>
                            )}
                            {item.summary.total_courses !== undefined && (
                              <div className="text-gray-500">
                                {item.summary.total_courses} courses analyzed
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Completed successfully</span>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-right space-x-1">
                        <button
                          onClick={() => handleViewDetails(item.id)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleExport(item.id)}
                          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Export CSV"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => navigate('/recommendations')}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Recommendations"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Delete Analysis"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No analysis runs in history"
          message="Run course similarity or curriculum gap analysis to start building audit trails and historical records."
          actionLabel="Run First Analysis"
          onAction={() => navigate('/analysis')}
          icon={<HistoryIcon className="w-8 h-8" />}
        />
      )}

      {/* Detail Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Analysis Run #{selectedAnalysis.id} Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 font-semibold block mb-0.5 uppercase">Type</span>
                  <span className="font-bold text-gray-800 capitalize">
                    {selectedAnalysis.analysis_type || selectedAnalysis.type}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 font-semibold block mb-0.5 uppercase">Method</span>
                  <span className="font-bold text-gray-800 uppercase">
                    {selectedAnalysis.method}
                  </span>
                </div>
              </div>

              {/* JSON preview of full results / summary */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Analysis Data Payload
                </label>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-80">
                  {JSON.stringify(selectedAnalysis, null, 2)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Delete Analysis #{itemToDelete.id}</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to permanently delete this analysis record from the database?
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAnalysis}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
