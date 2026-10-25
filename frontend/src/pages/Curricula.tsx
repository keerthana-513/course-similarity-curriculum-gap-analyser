import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Tag,
  BookOpen,
} from 'lucide-react';
import {
  getCurricula,
  createCurriculum,
  updateCurriculum,
  deleteCurriculum,
} from '../services/api';
import { Curriculum } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';

export const Curricula: React.FC = () => {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [topicsText, setTopicsText] = useState('');

  // Delete Confirm State
  const [curriculumToDelete, setCurriculumToDelete] = useState<Curriculum | null>(null);

  useEffect(() => {
    fetchCurricula();
  }, []);

  const fetchCurricula = async () => {
    setLoading(true);
    try {
      const res = await getCurricula();
      setCurricula(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load curricula', err);
      toast.error('Failed to load curricula list');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setDepartment('');
    setTopicsText('');
    setIsModalOpen(true);
  };

  const openEditModal = (curr: Curriculum) => {
    setIsEditing(true);
    setEditingId(curr.id);
    setName(curr.name);
    setDepartment(curr.department);
    const formattedTopics = Array.isArray(curr.topics)
      ? curr.topics.join('\n')
      : typeof curr.topics === 'string'
      ? curr.topics.split(',').map((t) => t.trim()).join('\n')
      : '';
    setTopicsText(formattedTopics);
    setIsModalOpen(true);
  };

  const handleSaveCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim()) {
      toast.error('Please specify curriculum name and department');
      return;
    }

    // Split topics by newline or comma
    const topics = topicsText
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (topics.length === 0) {
      toast.error('Please add at least one topic for the reference curriculum');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      name: name.trim(),
      department: department.trim(),
      topics,
    };

    try {
      if (isEditing && editingId) {
        await updateCurriculum(editingId, payload);
        toast.success(`Curriculum "${name}" updated successfully`);
      } else {
        await createCurriculum(payload);
        toast.success(`Curriculum "${name}" created successfully`);
      }
      setIsModalOpen(false);
      fetchCurricula();
    } catch (err: any) {
      console.error('Save curriculum error', err);
      toast.error(err.response?.data?.detail || 'Failed to save curriculum');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCurriculum = async () => {
    if (!curriculumToDelete) return;
    try {
      await deleteCurriculum(curriculumToDelete.id);
      toast.success(`Curriculum deleted successfully`);
      setCurriculumToDelete(null);
      fetchCurricula();
    } catch (err: any) {
      console.error('Delete curriculum error', err);
      toast.error(err.response?.data?.detail || 'Failed to delete curriculum');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reference Curricula</h1>
          <p className="text-sm text-gray-500 mt-1">
            Standardized benchmarks (e.g., ACM/IEEE guidelines, ABET standards) used to audit courses for gaps.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Curriculum Benchmark
        </button>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" text="Loading reference curricula..." className="py-24" />
      ) : curricula.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {curricula.map((curr) => {
            const topicsList = Array.isArray(curr.topics)
              ? curr.topics
              : typeof curr.topics === 'string'
              ? curr.topics.split(',').map((t) => t.trim()).filter(Boolean)
              : [];

            return (
              <div
                key={curr.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                      {curr.department}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {topicsList.length} Core Topics
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 mb-3" title={curr.name}>
                    {curr.name}
                  </h3>

                  {/* Topics Pills */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      <Tag className="w-3 h-3" />
                      <span>Benchmark Topics</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {topicsList.slice(0, 8).map((topic, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[11px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md"
                        >
                          {topic}
                        </span>
                      ))}
                      {topicsList.length > 8 && (
                        <span className="text-[10px] text-gray-400 self-center pl-1 font-medium">
                          +{topicsList.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(curr)}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                    title="Edit Curriculum"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurriculumToDelete(curr)}
                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                    title="Delete Curriculum"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No reference curricula defined"
          message="Create standard curriculum benchmarks with core syllabus topics to detect gaps in your institution's course offerings."
          actionLabel="Create Benchmark Curriculum"
          onAction={openAddModal}
          icon={<Layers className="w-8 h-8" />}
        />
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? `Edit Curriculum Benchmark` : 'New Curriculum Benchmark'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCurriculum} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Curriculum Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACM Computer Science Core 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Department / Field *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science, Data Science, AI"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Reference Topics (one per line or comma-separated) *
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="Data Structures&#10;Algorithms & Complexity&#10;Computer Architecture&#10;Operating Systems&#10;Database Systems&#10;Software Engineering"
                  value={topicsText}
                  onChange={(e) => setTopicsText(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Enter each canonical topic required in this curriculum benchmark.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : isEditing ? 'Update Benchmark' : 'Save Benchmark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {curriculumToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Delete Curriculum Benchmark</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete <span className="font-semibold text-gray-800">{curriculumToDelete.name}</span>? Future gap analyses will no longer compare against this standard.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setCurriculumToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCurriculum}
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

export default Curricula;
