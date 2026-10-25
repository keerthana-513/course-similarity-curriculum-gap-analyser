import React, { useEffect, useState } from 'react';
import {
  GitCompare,
  Sliders,
  Play,
  Download,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Cpu,
  Layers,
  Info,
} from 'lucide-react';
import {
  runSimilarityAnalysis,
  getNlpStatus,
  exportAnalysis,
  getAnalysisHistory,
  getAnalysisById,
} from '../services/api';
import { SimilarityAnalysisResult, SimilarityPair, NlpStatus } from '../types';
import HeatmapChart from '../components/HeatmapChart';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';

export const SimilarityAnalysis: React.FC = () => {
  const [method, setMethod] = useState<'tfidf' | 'semantic'>('tfidf');
  const [threshold, setThreshold] = useState<number>(0.6);
  const [nlpStatus, setNlpStatus] = useState<NlpStatus | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SimilarityAnalysisResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [pairFilter, setPairFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadInitialState();
  }, []);

  const loadInitialState = async () => {
    setLoadingInitial(true);
    try {
      // 1. Fetch NLP status
      try {
        const statusRes = await getNlpStatus();
        setNlpStatus(statusRes.data);
      } catch (e) {
        console.warn('Could not fetch NLP status', e);
      }

      // 2. Fetch latest similarity analysis from history if available
      const historyRes = await getAnalysisHistory();
      if (Array.isArray(historyRes.data) && historyRes.data.length > 0) {
        const latestSimilarity = historyRes.data.find(
          (h: any) => h.analysis_type === 'similarity' || h.type === 'similarity'
        );
        if (latestSimilarity) {
          try {
            const detailRes = await getAnalysisById(latestSimilarity.id);
            const detail = detailRes.data;
            const merged = {
              ...detail,
              ...(detail.results || {}),
              matrix: detail.results?.similarity_matrix || detail.similarity_matrix || detail.matrix,
              labels: detail.results?.course_labels || detail.course_labels || detail.labels,
              ranked_pairs: detail.results?.ranked_pairs || detail.ranked_pairs,
              high_overlap_pairs: detail.results?.high_overlap_pairs || detail.high_overlap_pairs,
              method: detail.results?.method || detail.parameters?.method || 'tfidf',
              threshold: detail.results?.threshold || detail.parameters?.threshold || 0.6,
            };
            setAnalysisResult(merged);
            if (merged.threshold) {
              setThreshold(merged.threshold);
            }
            if (merged.method && (merged.method === 'tfidf' || merged.method === 'semantic')) {
              setMethod(merged.method);
            }
          } catch (err) {
            console.warn('Failed to load analysis details', err);
          }
        }
      }
    } catch (err) {
      console.error('Error during initial load', err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    const toastId = toast.loading(`Running ${method.toUpperCase()} similarity analysis...`);
    try {
      const res = await runSimilarityAnalysis({
        method,
        threshold,
      });

      setAnalysisResult(res.data);
      toast.success('Similarity analysis completed!', { id: toastId });
    } catch (err: any) {
      console.error('Similarity analysis failed', err);
      toast.error(err.response?.data?.detail || 'Analysis failed. Ensure at least 2 courses exist.', {
        id: toastId,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCsv = async () => {
    if (!analysisResult?.id) {
      toast.error('No saved analysis ID to export');
      return;
    }
    const toastId = toast.loading('Exporting analysis CSV...');
    try {
      const res = await exportAnalysis(analysisResult.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `similarity_analysis_${analysisResult.id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded!', { id: toastId });
    } catch (err: any) {
      console.error('Export failed', err);
      toast.error('Export failed', { id: toastId });
    }
  };

  const handleDownloadReport = () => {
    if (!analysisResult) return;
    const pairs = analysisResult.ranked_pairs || analysisResult.pairs || [];
    const reportData = {
      analysis_id: analysisResult.id,
      method: analysisResult.method,
      threshold: analysisResult.threshold,
      generated_at: new Date().toISOString(),
      summary: analysisResult.summary,
      total_compared_pairs: pairs.length,
      high_overlap_pairs: pairs.filter((p) => (p.similarity || 0) >= threshold),
      all_pairs: pairs,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `similarity_report_${analysisResult.id || 'latest'}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Report downloaded');
  };

  // Extract pairs
  const pairsList: SimilarityPair[] =
    analysisResult?.ranked_pairs || analysisResult?.pairs || [];

  // Filter pairs
  const filteredPairs = pairsList.filter((pair) => {
    const sim = pair.similarity || 0;
    if (pairFilter === 'high') return sim >= (analysisResult?.threshold || 0.6);
    if (pairFilter === 'medium') return sim >= 0.3 && sim < (analysisResult?.threshold || 0.6);
    if (pairFilter === 'low') return sim < 0.3;
    return true;
  });

  const getSimilarityBadge = (sim: number) => {
    if (sim >= 0.6) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3" />
          {(sim * 100).toFixed(1)}% (High)
        </span>
      );
    }
    if (sim >= 0.3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {(sim * 100).toFixed(1)}% (Medium)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3 h-3" />
        {(sim * 100).toFixed(1)}% (Low)
      </span>
    );
  };

  if (loadingInitial) {
    return <LoadingSpinner size="lg" text="Loading similarity analysis module..." className="py-24" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Course Similarity Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare syllabi content using TF-IDF or deep Sentence Transformers to detect curriculum overlap.
          </p>
        </div>

        {/* NLP Status Badge */}
        {nlpStatus && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs shadow-xs">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span className="text-gray-600">Semantic Model:</span>
            {nlpStatus.semantic_available ? (
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Ready ({nlpStatus.model_name || 'Sentence-Transformers'})
              </span>
            ) : (
              <span className="font-semibold text-amber-600 flex items-center gap-1" title="Falling back to TF-IDF">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                TF-IDF Only
              </span>
            )}
          </div>
        )}
      </div>

      {/* Analysis Control Panel Card */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-100">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Analysis Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Method selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
              Comparison Method
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMethod('tfidf')}
                className={`py-2 text-xs font-semibold rounded-md transition-all ${
                  method === 'tfidf'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                TF-IDF (Lexical)
              </button>
              <button
                type="button"
                onClick={() => setMethod('semantic')}
                disabled={nlpStatus?.semantic_available === false}
                className={`py-2 text-xs font-semibold rounded-md transition-all ${
                  method === 'semantic'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : nlpStatus?.semantic_available === false
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={
                  nlpStatus?.semantic_available === false
                    ? 'Semantic transformer model is unavailable in environment'
                    : 'Dense Sentence Embeddings'
                }
              >
                Semantic (AI)
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {method === 'tfidf'
                ? 'Matches keyword frequencies across course syllabi.'
                : 'Understands conceptual meaning and context beyond keywords.'}
            </p>
          </div>

          {/* Threshold Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase">
                Overlap Threshold
              </label>
              <span className="text-xs font-mono font-bold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded">
                {(threshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>10% (Permissive)</span>
              <span>50%</span>
              <span>100% (Exact)</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-end md:justify-end">
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              <Play className="w-4 h-4 fill-current" />
              {isRunning ? 'Analyzing Syllabi...' : 'Execute Analysis'}
            </button>
          </div>
        </div>
      </div>

      {isRunning ? (
        <LoadingSpinner size="lg" text="Computing pairwise similarity vectors & TF-IDF matrices..." className="py-20" />
      ) : analysisResult ? (
        <div className="space-y-6">
          {/* Summary Banner & Export Controls */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <GitCompare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {analysisResult.method.toUpperCase()} Similarity Analysis Completed
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Compared {analysisResult.labels?.length || 0} courses • Threshold: {(analysisResult.threshold * 100).toFixed(0)}%
                  {analysisResult.summary?.high_overlap_count !== undefined && (
                    <span className="ml-2 font-semibold text-rose-600">
                      • {analysisResult.summary.high_overlap_count} high-overlap pairs detected
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {analysisResult.id && (
                <button
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Export CSV
                </button>
              )}
              <button
                onClick={handleDownloadReport}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                Download Report
              </button>
            </div>
          </div>

          {/* Heatmap Visualization */}
          <HeatmapChart
            matrix={analysisResult.matrix || analysisResult.similarity_matrix}
            labels={analysisResult.labels || analysisResult.course_labels || []}
            title="Syllabus Similarity Heatmap"
            subtitle="Hover over cells to examine exact pairwise cosine similarities"
          />

          {/* Ranked Overlap Pairs List */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Ranked Similarity Pairs</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sorted by highest cosine similarity score
                </p>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg text-xs">
                <button
                  onClick={() => setPairFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    pairFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  All ({pairsList.length})
                </button>
                <button
                  onClick={() => setPairFilter('high')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    pairFilter === 'high' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  High (&ge;{(threshold * 100).toFixed(0)}%)
                </button>
                <button
                  onClick={() => setPairFilter('medium')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    pairFilter === 'medium' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Medium (30-{(threshold * 100).toFixed(0)}%)
                </button>
                <button
                  onClick={() => setPairFilter('low')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    pairFilter === 'low' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Low (&lt;30%)
                </button>
              </div>
            </div>

            {filteredPairs.length > 0 ? (
              <div className="mt-4 divide-y divide-gray-100">
                {filteredPairs.map((pair, index) => {
                  const isHigh = (pair.similarity || 0) >= threshold;
                  return (
                    <div
                      key={index}
                      className={`py-4 px-3 rounded-xl transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isHigh ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-gray-500">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {pair.course1_name || pair.course1 || pair.course1_id}
                          </span>
                          <span className="text-xs text-gray-400 font-semibold px-1">↔</span>
                          <span className="text-sm font-bold text-gray-900">
                            {pair.course2_name || pair.course2 || pair.course2_id}
                          </span>
                        </div>

                        {/* Common Terms */}
                        {pair.common_terms && pair.common_terms.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[11px] text-gray-400 font-medium">
                              Common Key Terms:
                            </span>
                            {pair.common_terms.map((term, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {getSimilarityBadge(pair.similarity || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 text-sm">
                No pairs match the selected filter criteria.
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Ready to run similarity analysis"
          message="Configure your preferred NLP model and overlap threshold above, then click 'Execute Analysis' to compute similarity scores."
          actionLabel="Execute Analysis"
          onAction={handleRunAnalysis}
          icon={<GitCompare className="w-8 h-8" />}
        />
      )}
    </div>
  );
};

export default SimilarityAnalysis;
