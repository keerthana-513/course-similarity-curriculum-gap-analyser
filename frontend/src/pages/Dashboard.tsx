import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  GitCompare,
  Target,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { getCourses, getAnalysisHistory, getCurricula, getAnalysisById } from '../services/api';
import { Course, AnalysisHistoryItem, SimilarityAnalysisResult, Curriculum } from '../types';
import MetricCard from '../components/MetricCard';
import HeatmapChart from '../components/HeatmapChart';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [latestSimilarity, setLatestSimilarity] = useState<SimilarityAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch courses, history, curricula in parallel
      const [coursesRes, historyRes, curriculaRes] = await Promise.allSettled([
        getCourses(),
        getAnalysisHistory(),
        getCurricula(),
      ]);

      const courseData = coursesRes.status === 'fulfilled' ? coursesRes.value.data : [];
      const historyData = historyRes.status === 'fulfilled' ? historyRes.value.data : [];
      const curriculaData = curriculaRes.status === 'fulfilled' ? curriculaRes.value.data : [];

      setCourses(Array.isArray(courseData) ? courseData : []);
      setHistory(Array.isArray(historyData) ? historyData : []);
      setCurricula(Array.isArray(curriculaData) ? curriculaData : []);

      // If history exists, find the latest similarity analysis and fetch full details if matrix not in summary
      if (Array.isArray(historyData) && historyData.length > 0) {
        const similarityAnalyses = historyData.filter(
          (h: any) => h.analysis_type === 'similarity' || h.type === 'similarity'
        );
        if (similarityAnalyses.length > 0) {
          const latestId = similarityAnalyses[0].id;
          try {
            const detailRes = await getAnalysisById(latestId);
            // The API returns { results: { similarity_matrix, course_labels, ... } }
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
            setLatestSimilarity(merged);
          } catch (err) {
            console.warn('Could not load latest similarity detail', err);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Derive metrics
  const totalCourses = courses.length;
  const totalAnalyses = history.length;
  
  // Calculate high-overlap count from latest similarity
  const highOverlapPairs =
    latestSimilarity?.high_overlap_pairs ||
    latestSimilarity?.ranked_pairs?.filter((p) => (p.similarity || 0) >= (latestSimilarity.threshold || 0.6)) ||
    latestSimilarity?.pairs?.filter((p) => (p.similarity || 0) >= 0.6) ||
    [];
  const highOverlapCount = highOverlapPairs.length;

  // Approximate gap count from curricula topics
  const totalCurricula = curricula.length;

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading dashboard metrics and analyses..." className="min-h-[60vh]" />;
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Curriculum Intelligence Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time overview of course similarities, curriculum coverage, and automated recommendations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/analysis')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <GitCompare className="w-4 h-4" />
            Run Similarity
          </button>
          <button
            onClick={() => navigate('/gap-analysis')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-semibold rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Target className="w-4 h-4 text-indigo-600" />
            Analyze Gaps
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Courses"
          value={totalCourses}
          icon={<BookOpen className="w-5 h-5" />}
          color="indigo"
          subtitle={totalCourses > 0 ? `${new Set(courses.map(c => c.department)).size} active departments` : 'No courses imported yet'}
        />
        <MetricCard
          title="High-Overlap Pairs"
          value={highOverlapCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={highOverlapCount > 0 ? 'red' : 'green'}
          badge={highOverlapCount > 0 ? 'Action Needed' : 'Healthy'}
          subtitle={highOverlapCount > 0 ? 'Similarity score >= 60%' : 'No redundancy detected'}
        />
        <MetricCard
          title="Curricula Tracked"
          value={totalCurricula}
          icon={<Layers className="w-5 h-5" />}
          color="blue"
          subtitle={`${curricula.reduce((acc, c) => acc + (Array.isArray(c.topics) ? c.topics.length : (c.topics ? c.topics.split(',').length : 0)), 0)} reference topics`}
        />
        <MetricCard
          title="Analysis Runs"
          value={totalAnalyses}
          icon={<TrendingUp className="w-5 h-5" />}
          color="amber"
          subtitle={history.length > 0 ? `Latest: ${new Date(history[0].created_at).toLocaleDateString()}` : 'No history yet'}
        />
      </div>

      {/* Main Content Grid: Heatmap + High-Overlap Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap (2 columns) */}
        <div className="lg:col-span-2">
          {latestSimilarity && latestSimilarity.matrix ? (
            <HeatmapChart
              matrix={latestSimilarity.matrix || latestSimilarity.similarity_matrix}
              labels={latestSimilarity.labels || latestSimilarity.course_labels || []}
              title={`Latest Similarity Heatmap (${latestSimilarity.method.toUpperCase()})`}
              subtitle={`Threshold: ${(latestSimilarity.threshold * 100).toFixed(0)}% • ${latestSimilarity.labels?.length || 0} Courses Compared`}
            />
          ) : (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Similarity Heatmap</h3>
                <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 font-medium rounded-full">
                  Pending Run
                </span>
              </div>
              <EmptyState
                title="No similarity analysis found"
                message="Run a similarity analysis on your courses to visualize syllabus overlaps on an interactive colored heatmap."
                actionLabel="Run Similarity Analysis"
                onAction={() => navigate('/analysis')}
                icon={<GitCompare className="w-8 h-8" />}
              />
            </div>
          )}
        </div>

        {/* High-Overlap Alerts & Recommendations Quick Feed (1 column) */}
        <div className="space-y-6">
          {/* High Overlap Alerts */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-gray-900">High-Overlap Alerts</h3>
              </div>
              {highOverlapCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                  {highOverlapCount} Flagged
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {highOverlapPairs.length > 0 ? (
                highOverlapPairs.slice(0, 4).map((pair, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-rose-50/50 border border-rose-100 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700">
                        {((pair.similarity || 0) * 100).toFixed(0)}% Similarity
                      </span>
                      <span className="text-[11px] text-gray-500">Duplicate Risk</span>
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-gray-800">
                      {pair.course1_name || pair.course1 || pair.course1_id}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 my-0.5">
                      <span>vs</span>
                    </div>
                    <div className="text-xs font-medium text-gray-800">
                      {pair.course2_name || pair.course2 || pair.course2_id}
                    </div>
                    {pair.common_terms && pair.common_terms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pair.common_terms.slice(0, 3).map((term, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] bg-white border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-medium text-gray-700">No redundancy flags</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {courses.length < 2
                      ? 'Add at least 2 courses to analyze overlaps'
                      : 'Courses have clear syllabus boundaries'}
                  </p>
                </div>
              )}
            </div>

            {highOverlapPairs.length > 4 && (
              <button
                onClick={() => navigate('/analysis')}
                className="w-full mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 py-1"
              >
                View all {highOverlapPairs.length} overlapping pairs <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions & AI Recommendations link */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl p-5 text-white shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-indigo-300" />
              <h3 className="text-sm font-semibold text-white">Smart Recommendations</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Curriculum gap and overlap suggestions powered by NLP vector comparison.
            </p>
            <button
              onClick={() => navigate('/recommendations')}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              <span>Explore Recommendations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">Recent Analysis Activity</h3>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => navigate('/history')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View Full History <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {history.length > 0 ? (
          <div className="mt-4 divide-y divide-gray-100">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between hover:bg-gray-50/50 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      item.analysis_type === 'similarity'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {item.analysis_type === 'similarity' ? (
                      <GitCompare className="w-4 h-4" />
                    ) : (
                      <Target className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 capitalize">
                      {item.analysis_type} Analysis
                    </h4>
                    <p className="text-xs text-gray-500">
                      Method: <span className="font-semibold uppercase">{item.method || 'TF-IDF'}</span>
                      {item.parameters?.threshold && ` • Threshold: ${item.parameters.threshold}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p className="text-sm">No analysis history recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
