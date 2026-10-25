import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  AlertTriangle,
  GitMerge,
  PlusCircle,
  RefreshCw,
  CheckCircle,
  BookOpen,
  Filter,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { getRecommendations, getAnalysisHistory } from '../services/api';
import { Recommendation, AnalysisHistoryItem } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';

export const Recommendations: React.FC = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    fetchHistoryAndRecommendations();
  }, []);

  const fetchHistoryAndRecommendations = async () => {
    setLoading(true);
    try {
      const historyRes = await getAnalysisHistory();
      const historyItems: AnalysisHistoryItem[] = Array.isArray(historyRes.data)
        ? historyRes.data
        : [];
      setHistory(historyItems);

      if (historyItems.length > 0) {
        const initialId = historyItems[0].id;
        setSelectedAnalysisId(initialId);
        await loadRecommendationsForAnalysis(initialId);
      }
    } catch (err: any) {
      console.error('Failed to load history for recommendations', err);
      toast.error('Failed to load analysis history');
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendationsForAnalysis = async (analysisId: number) => {
    setLoadingRecs(true);
    try {
      const res = await getRecommendations(analysisId);
      // Handles both array or object with recommendations list
      const recs = Array.isArray(res.data)
        ? res.data
        : res.data?.recommendations || [];
      setRecommendations(recs);
    } catch (err: any) {
      console.error('Failed to load recommendations', err);
      toast.error(err.response?.data?.detail || 'Could not load recommendations for this run');
      setRecommendations([]);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleAnalysisChange = (id: number) => {
    setSelectedAnalysisId(id);
    loadRecommendationsForAnalysis(id);
  };

  // Filter recommendations
  const filteredRecs = recommendations.filter((rec) => {
    const matchesType =
      typeFilter === 'all' ||
      rec.type?.toLowerCase() === typeFilter.toLowerCase();
    const matchesPriority =
      priorityFilter === 'all' ||
      rec.priority?.toLowerCase() === priorityFilter.toLowerCase();
    return matchesType && matchesPriority;
  });

  const getPriorityBadge = (priority: string) => {
    const p = priority?.toLowerCase();
    if (p === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          High Priority
        </span>
      );
    }
    if (p === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Medium Priority
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        Low Priority
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const t = type?.toLowerCase();
    if (t === 'merge') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <GitMerge className="w-3 h-3" />
          Merge Redundant Content
        </span>
      );
    }
    if (t === 'add_topic' || t === 'add') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <PlusCircle className="w-3 h-3" />
          Add Missing Topic
        </span>
      );
    }
    if (t === 'update' || t === 'split') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <RefreshCw className="w-3 h-3" />
          Update Syllabus
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
        <BookOpen className="w-3 h-3" />
        {type || 'Curriculum Action'}
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading smart recommendations..." className="py-24" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Smart Recommendations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Evidence-based curriculum improvements synthesized by the NLP analysis engine.
          </p>
        </div>

        {/* Analysis selector if past analyses exist */}
        {history.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Analysis Run:</label>
            <select
              value={selectedAnalysisId || ''}
              onChange={(e) => handleAnalysisChange(Number(e.target.value))}
              className="text-xs font-medium px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  #{h.id} - {h.analysis_type?.toUpperCase()} ({new Date(h.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* AI Disclaimer Banner */}
      <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-4.5 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-semibold text-amber-950">AI & NLP Advisory Notice</p>
          <p className="text-amber-800 leading-relaxed">
            Recommendations are generated automatically using TF-IDF lexical matching and sentence transformer embeddings.
            They indicate statistical text overlaps and missing reference concepts, but curriculum committees and academic
            department heads must review context and pedagogy before implementing curriculum modifications.
          </p>
        </div>
      </div>

      {/* Filters Card */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-700">Filter Recommendations:</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Priority Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none font-medium"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500">Action Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none font-medium"
              >
                <option value="all">All Types</option>
                <option value="merge">Merge</option>
                <option value="add_topic">Add Topic</option>
                <option value="update">Update</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations Cards List */}
      {loadingRecs ? (
        <LoadingSpinner size="lg" text="Retrieving recommendations for this run..." className="py-20" />
      ) : filteredRecs.length > 0 ? (
        <div className="grid grid-cols-1 gap-5">
          {filteredRecs.map((rec, index) => {
            const related = Array.isArray(rec.related_courses)
              ? rec.related_courses
              : typeof rec.related_courses === 'string' && rec.related_courses
              ? [rec.related_courses]
              : [];

            return (
              <div
                key={rec.id || index}
                className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getTypeBadge(rec.type)}
                    {getPriorityBadge(rec.priority)}
                  </div>

                  {rec.title && (
                    <span className="text-xs font-semibold text-gray-500">{rec.title}</span>
                  )}
                </div>

                <div className="mt-4 space-y-3.5">
                  {/* Related Courses */}
                  {related.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Target Courses:
                      </span>
                      {related.map((course, cIdx) => (
                        <span
                          key={cIdx}
                          className="text-xs font-bold font-mono px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md border border-slate-200"
                        >
                          {course}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Evidence */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                      Evidence from Analysis:
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-mono">
                      {rec.evidence || 'Statistical overlap identified during pairwise text comparison.'}
                    </p>
                  </div>

                  {/* Reason */}
                  <div>
                    <span className="text-xs font-semibold text-gray-700 block mb-1">
                      Rationale & Impact:
                    </span>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {rec.reason}
                    </p>
                  </div>

                  {/* Suggested Action */}
                  <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                      Suggested Academic Action:
                    </span>
                    <p className="text-sm text-indigo-950 font-medium leading-relaxed">
                      {rec.suggested_action}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          title="No recommendations generated yet"
          message="Run a similarity analysis or curriculum gap analysis first. The AI engine will automatically synthesize recommendations from the results."
          actionLabel="Run Similarity Analysis"
          onAction={() => navigate('/analysis')}
          icon={<Sparkles className="w-8 h-8" />}
        />
      ) : (
        <EmptyState
          title="No recommendations found for this run"
          message={
            recommendations.length > 0
              ? 'No recommendations match the current type or priority filter.'
              : 'The analysis found no critical redundancy or missing gaps requiring action.'
          }
          icon={<CheckCircle className="w-8 h-8 text-emerald-500" />}
        />
      )}
    </div>
  );
};

export default Recommendations;
