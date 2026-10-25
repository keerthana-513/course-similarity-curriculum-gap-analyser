import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Play,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getCurricula, runGapAnalysis, getAnalysisHistory, getAnalysisById } from '../services/api';
import { Curriculum, GapAnalysisResult, TopicCoverage } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import MetricCard from '../components/MetricCard';
import toast from 'react-hot-toast';

export const GapAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<number | ''>('');
  const [method, setMethod] = useState<string>('tfidf');
  const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
  const [loadingCurricula, setLoadingCurricula] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'covered' | 'partial' | 'missing'>('all');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoadingCurricula(true);
    try {
      const [curriculaRes, historyRes] = await Promise.allSettled([
        getCurricula(),
        getAnalysisHistory(),
      ]);

      const currList = curriculaRes.status === 'fulfilled' ? curriculaRes.value.data : [];
      setCurricula(Array.isArray(currList) ? currList : []);

      if (Array.isArray(currList) && currList.length > 0) {
        setSelectedCurriculumId(currList[0].id);
      }

      // Check for past gap analyses in history to restore state
      const histList = historyRes.status === 'fulfilled' ? historyRes.value.data : [];
      if (Array.isArray(histList) && histList.length > 0) {
        const latestGap = histList.find((h: any) => h.analysis_type === 'gap' || h.type === 'gap');
        if (latestGap) {
          try {
            const detail = await getAnalysisById(latestGap.id);
            setGapResult(detail.data);
            if (detail.data.curriculum_id) {
              setSelectedCurriculumId(detail.data.curriculum_id);
            }
          } catch (e) {
            console.warn('Could not restore latest gap analysis', e);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching curricula', err);
      toast.error('Failed to load curricula');
    } finally {
      setLoadingCurricula(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedCurriculumId) {
      toast.error('Please select a reference curriculum');
      return;
    }

    setIsRunning(true);
    const toastId = toast.loading('Evaluating curriculum gaps against course offerings...');
    try {
      const res = await runGapAnalysis({
        curriculum_id: Number(selectedCurriculumId),
        method,
      });

      setGapResult(res.data);
      toast.success('Curriculum gap analysis complete!', { id: toastId });
    } catch (err: any) {
      console.error('Gap analysis failed', err);
      toast.error(err.response?.data?.detail || 'Gap analysis failed', { id: toastId });
    } finally {
      setIsRunning(false);
    }
  };

  // Derive topic coverage list
  const topicList: TopicCoverage[] = gapResult?.topic_coverage || gapResult?.topics || [];

  // Summary counts
  const summary = gapResult?.coverage_summary || {
    covered: topicList.filter((t) => t.status === 'covered').length,
    partially_covered: topicList.filter((t) => t.status === 'partially_covered' || t.status === 'partial').length,
    not_covered: topicList.filter((t) => t.status === 'not_covered' || t.status === 'missing').length,
    total_topics: topicList.length,
    coverage_percentage:
      topicList.length > 0
        ? Math.round(
            (topicList.filter((t) => t.status === 'covered').length / topicList.length) * 100
          )
        : 0,
  };

  const coveredCount = summary.covered || 0;
  const partialCount = summary.partially_covered || 0;
  const missingCount = summary.not_covered ?? summary.missing ?? 0;
  const totalTopics = summary.total_topics || coveredCount + partialCount + missingCount;
  const coveragePercent = summary.coverage_percentage ?? (totalTopics > 0 ? Math.round((coveredCount / totalTopics) * 100) : 0);

  // Filter topics
  const filteredTopics = topicList.filter((topic) => {
    const s = topic.status?.toLowerCase();
    if (statusFilter === 'covered') return s === 'covered';
    if (statusFilter === 'partial') return s === 'partially_covered' || s === 'partial';
    if (statusFilter === 'missing') return s === 'not_covered' || s === 'missing';
    return true;
  });

  // Prepare chart data for course-wise topic coverage
  const chartData = React.useMemo(() => {
    if (gapResult?.course_coverage && gapResult.course_coverage.length > 0) {
      return gapResult.course_coverage.map((c) => ({
        name: c.course_id || c.course_name,
        fullName: c.course_name,
        coveredTopics: c.covered_count,
      }));
    }

    // Compute dynamically from topic coverage if not directly provided
    const courseMap: Record<string, { id: string; name: string; count: number }> = {};
    topicList.forEach((topic) => {
      const courses = topic.covered_by || topic.matching_courses || [];
      courses.forEach((item) => {
        const id = typeof item === 'string' ? item : item.course_id || item.course_name;
        const name = typeof item === 'string' ? item : item.course_name || item.course_id;
        if (!courseMap[id]) {
          courseMap[id] = { id, name, count: 0 };
        }
        courseMap[id].count += 1;
      });
    });

    return Object.values(courseMap).map((c) => ({
      name: c.id,
      fullName: c.name,
      coveredTopics: c.count,
    }));
  }, [gapResult, topicList]);

  if (loadingCurricula) {
    return <LoadingSpinner size="lg" text="Loading reference curricula..." className="py-24" />;
  }

  if (curricula.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Curriculum Gap Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare active course syllabi against benchmark reference curricula.
          </p>
        </div>
        <EmptyState
          title="No reference curricula available"
          message="To detect curriculum gaps and missing syllabus topics, please define or import at least one reference curriculum first."
          actionLabel="Manage Curricula"
          onAction={() => navigate('/curricula')}
          icon={<Layers className="w-8 h-8" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Curriculum Gap Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Audit course offerings against standards to detect missing competencies, partial coverage, and strengths.
          </p>
        </div>

        <button
          onClick={() => navigate('/curricula')}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-xs transition-colors self-start md:self-auto"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          Manage Reference Curricula
        </button>
      </div>

      {/* Control Card */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
          {/* Select Curriculum */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
              Reference Curriculum Benchmark *
            </label>
            <select
              value={selectedCurriculumId}
              onChange={(e) => setSelectedCurriculumId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {curricula.map((curr) => (
                <option key={curr.id} value={curr.id}>
                  {curr.name} ({curr.department})
                </option>
              ))}
            </select>
          </div>

          {/* Method */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
              Matching Engine
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="tfidf">TF-IDF Vector Matching</option>
              <option value="semantic">Semantic Embeddings</option>
            </select>
          </div>

          {/* Run Button */}
          <div className="md:col-span-1">
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning || !selectedCurriculumId}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
            >
              <Play className="w-4 h-4 fill-current" />
              {isRunning ? 'Analyzing Curriculum...' : 'Run Gap Analysis'}
            </button>
          </div>
        </div>
      </div>

      {isRunning ? (
        <LoadingSpinner size="lg" text="Matching syllabus topics against reference curriculum..." className="py-20" />
      ) : gapResult ? (
        <div className="space-y-6">
          {/* Coverage Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              title="Coverage Score"
              value={`${coveragePercent}%`}
              icon={<Target className="w-5 h-5" />}
              color={coveragePercent >= 75 ? 'green' : coveragePercent >= 50 ? 'amber' : 'red'}
              subtitle={`${coveredCount} of ${totalTopics} topics fully covered`}
            />
            <MetricCard
              title="Fully Covered Topics"
              value={coveredCount}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="green"
              subtitle="Addressed comprehensively in syllabi"
            />
            <MetricCard
              title="Partially Covered"
              value={partialCount}
              icon={<HelpCircle className="w-5 h-5" />}
              color="amber"
              subtitle="Moderate overlap or peripheral mention"
            />
            <MetricCard
              title="Uncovered / Missing Gaps"
              value={missingCount}
              icon={<AlertCircle className="w-5 h-5" />}
              color="red"
              badge={missingCount > 0 ? 'High Priority' : 'Zero Gaps'}
              subtitle="Absent from current course descriptions"
            />
          </div>

          {/* Topic Coverage by Course Bar Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Course Topic Contribution Distribution
                  </h3>
                </div>
                <span className="text-xs text-gray-400">Topics covered per course offering</span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-gray-900 text-white text-xs p-3 rounded-lg shadow-xl">
                              <p className="font-bold text-indigo-300">{data.fullName || data.name}</p>
                              <p className="mt-1 text-gray-200">
                                Topics Addressed: <span className="font-semibold text-white">{data.coveredTopics}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="coveredTopics" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill="#4F46E5" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Topic Breakdown Table */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Reference Topic Audit</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detailed status of each benchmark curriculum topic
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  All ({topicList.length})
                </button>
                <button
                  onClick={() => setStatusFilter('covered')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'covered' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Covered ({coveredCount})
                </button>
                <button
                  onClick={() => setStatusFilter('partial')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'partial' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Partial ({partialCount})
                </button>
                <button
                  onClick={() => setStatusFilter('missing')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'missing' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Missing ({missingCount})
                </button>
              </div>
            </div>

            {filteredTopics.length > 0 ? (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Benchmark Topic</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Matching Courses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredTopics.map((item, idx) => {
                      const isCovered = item.status === 'covered';
                      const isPartial = item.status === 'partially_covered' || item.status === 'partial';
                      const matchingCourses = item.covered_by || item.matching_courses || [];

                      return (
                        <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-3 font-semibold text-gray-800">
                            {item.topic}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {isCovered && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Fully Covered
                              </span>
                            )}
                            {isPartial && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <HelpCircle className="w-3 h-3" />
                                Partially Covered
                              </span>
                            )}
                            {!isCovered && !isPartial && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertCircle className="w-3 h-3" />
                                Missing Topic
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            {matchingCourses.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {matchingCourses.map((c: any, cIdx: number) => {
                                  const cId = typeof c === 'string' ? c : c.course_id || c.course_name;
                                  const cName = typeof c === 'string' ? c : c.course_name || c.course_id;
                                  const cScore = typeof c === 'object' && c.score ? ` (${(c.score * 100).toFixed(0)}%)` : '';
                                  return (
                                    <span
                                      key={cIdx}
                                      title={cName}
                                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md font-medium"
                                    >
                                      <BookOpen className="w-3 h-3 text-indigo-500" />
                                      {cId}{cScore}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-rose-500 italic">
                                No course currently covers this concept
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 text-sm">
                No topics match the selected status filter.
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Ready to run curriculum gap analysis"
          message="Select a reference benchmark curriculum from the dropdown above and click 'Run Gap Analysis' to identify curriculum omissions."
          actionLabel="Run Gap Analysis"
          onAction={handleRunAnalysis}
          icon={<Target className="w-8 h-8" />}
        />
      )}
    </div>
  );
};

export default GapAnalysis;
