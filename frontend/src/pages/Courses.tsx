import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  X,
  UploadCloud,
  Layers,
} from 'lucide-react';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  importCSV,
  uploadFile,
  getSampleCSV,
  deleteSampleData,
} from '../services/api';
import { Course } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';

export const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);

  // Form Fields
  const [courseId, setCourseId] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [description, setDescription] = useState('');
  const [syllabusTopics, setSyllabusTopics] = useState('');

  // Delete Confirm Modal State
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeleteSampleConfirmOpen, setIsDeleteSampleConfirmOpen] = useState(false);

  // File Input Refs
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const syllabusFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async (search?: string) => {
    setLoading(true);
    try {
      const res = await getCourses(search || undefined);
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to load courses', err);
      toast.error('Failed to load course list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses(searchQuery);
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingCourseId(null);
    setCourseId('');
    setName('');
    setDepartment('');
    setSemester('');
    setDescription('');
    setSyllabusTopics('');
    setIsModalOpen(true);
  };

  const openEditModal = (course: Course) => {
    setIsEditing(true);
    setEditingCourseId(course.course_id);
    setCourseId(course.course_id);
    setName(course.name);
    setDepartment(course.department);
    setSemester(course.semester);
    setDescription(course.description);
    
    // Topics may be array or comma string
    const topicsFormatted = Array.isArray(course.syllabus_topics)
      ? course.syllabus_topics.join(', ')
      : course.syllabus_topics || '';
    setSyllabusTopics(topicsFormatted);

    setIsModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId.trim() || !name.trim() || !department.trim()) {
      toast.error('Please fill in Course ID, Name, and Department');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      course_id: courseId.trim(),
      name: name.trim(),
      department: department.trim(),
      semester: semester.trim(),
      description: description.trim(),
      syllabus_topics: syllabusTopics
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };

    try {
      if (isEditing && editingCourseId) {
        await updateCourse(editingCourseId, payload);
        toast.success(`Course ${courseId} updated successfully`);
      } else {
        await createCourse(payload);
        toast.success(`Course ${courseId} created successfully`);
      }
      setIsModalOpen(false);
      fetchCourses(searchQuery);
    } catch (err: any) {
      console.error('Error saving course', err);
      toast.error(err.response?.data?.detail || 'Failed to save course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      await deleteCourse(courseToDelete.course_id);
      toast.success(`Course ${courseToDelete.course_id} deleted`);
      setCourseToDelete(null);
      fetchCourses(searchQuery);
    } catch (err: any) {
      console.error('Error deleting course', err);
      toast.error(err.response?.data?.detail || 'Failed to delete course');
    }
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Importing courses from CSV...');
    try {
      const res = await importCSV(file);
      toast.success(res.data?.message || 'Courses imported successfully!', { id: toastId });
      fetchCourses();
    } catch (err: any) {
      console.error('CSV Import error', err);
      toast.error(err.response?.data?.detail || 'Failed to import CSV', { id: toastId });
    } finally {
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }
  };

  const handleDownloadSampleCsv = async () => {
    const toastId = toast.loading('Downloading sample CSV...');
    try {
      const res = await getSampleCSV();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_courses.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Sample CSV downloaded', { id: toastId });
    } catch (err: any) {
      console.error('Failed to download sample CSV', err);
      toast.error('Failed to download sample CSV', { id: toastId });
    }
  };

  const handleDeleteSampleData = async () => {
    const toastId = toast.loading('Deleting sample courses...');
    try {
      await deleteSampleData();
      toast.success('Sample data removed', { id: toastId });
      setIsDeleteSampleConfirmOpen(false);
      fetchCourses();
    } catch (err: any) {
      console.error('Delete sample data error', err);
      toast.error(err.response?.data?.detail || 'Failed to delete sample data', { id: toastId });
    }
  };

  const handleUploadSyllabusFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingText(true);
    const toastId = toast.loading(`Extracting text from ${file.name}...`);
    try {
      const res = await uploadFile(file);
      const extractedText = res.data?.extracted_text || res.data?.text || res.data?.content || '';
      if (extractedText) {
        setDescription(extractedText);
        toast.success('Text extracted into description!', { id: toastId });
      } else {
        toast.success('File uploaded successfully', { id: toastId });
      }
    } catch (err: any) {
      console.error('Upload syllabus error', err);
      toast.error(err.response?.data?.detail || 'Failed to extract text from file', { id: toastId });
    } finally {
      setIsExtractingText(false);
      if (syllabusFileInputRef.current) syllabusFileInputRef.current.value = '';
    }
  };

  // Filter departments
  const departments = Array.from(new Set(courses.map((c) => c.department).filter(Boolean)));
  const filteredCourses = courses.filter((c) => {
    const matchesDept = selectedDept === 'all' || c.department === selectedDept;
    const matchesSearch =
      searchQuery === '' ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.course_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Course Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage academic course descriptions, syllabus topics, and metadata for NLP gap analysis.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={csvFileInputRef}
            onChange={handleImportCsv}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => csvFileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            Import CSV
          </button>

          <button
            onClick={handleDownloadSampleCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            Sample CSV
          </button>

          <button
            onClick={() => setIsDeleteSampleConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            Delete Sample Data
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses by ID, title, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </form>

        {/* Department Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedDept === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Departments ({courses.length})
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedDept === dept
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {dept} ({courses.filter((c) => c.department === dept).length})
            </button>
          ))}
        </div>
      </div>

      {/* Course Cards Grid */}
      {loading ? (
        <LoadingSpinner size="lg" text="Loading course database..." className="py-20" />
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const topicsArray = Array.isArray(course.syllabus_topics)
              ? course.syllabus_topics
              : typeof course.syllabus_topics === 'string'
              ? course.syllabus_topics.split(',').map((t) => t.trim()).filter(Boolean)
              : [];

            return (
              <div
                key={course.course_id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-mono font-bold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                      {course.course_id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {course.department}
                      </span>
                      {course.semester && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {course.semester}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 line-clamp-1 mb-2" title={course.name}>
                    {course.name}
                  </h3>

                  <p className="text-xs text-gray-600 line-clamp-3 mb-4 leading-relaxed">
                    {course.description || 'No description provided.'}
                  </p>

                  {/* Topics Pills */}
                  {topicsArray.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Syllabus Topics ({topicsArray.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {topicsArray.slice(0, 4).map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full"
                          >
                            {t}
                          </span>
                        ))}
                        {topicsArray.length > 4 && (
                          <span className="text-[10px] text-gray-400 self-center pl-1">
                            +{topicsArray.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(course)}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                    title="Edit Course"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCourseToDelete(course)}
                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                    title="Delete Course"
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
          title="No courses found"
          message={
            searchQuery || selectedDept !== 'all'
              ? 'No courses match your current search criteria. Try resetting filters.'
              : 'You have not added any courses yet. Add a course or import from sample CSV.'
          }
          actionLabel="Add Course"
          onAction={openAddModal}
          icon={<BookOpen className="w-8 h-8" />}
        />
      )}

      {/* Add / Edit Course Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? `Edit Course ${editingCourseId}` : 'Add New Course'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Course ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS101"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    disabled={isEditing}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS, DS, AI, ML"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fall 2024, Semester 2"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase">
                    Description & Overview
                  </label>
                  <input
                    type="file"
                    ref={syllabusFileInputRef}
                    onChange={handleUploadSyllabusFile}
                    accept=".pdf,.txt,.docx"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => syllabusFileInputRef.current?.click()}
                    disabled={isExtractingText}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    {isExtractingText ? 'Extracting text...' : 'Upload PDF / TXT to fill'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Detailed course overview, learning outcomes, and foundational concepts..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Syllabus Topics (comma-separated)
                </label>
                <textarea
                  rows={2}
                  placeholder="Arrays, Linked Lists, Trees, Graph Algorithms, Dynamic Programming"
                  value={syllabusTopics}
                  onChange={(e) => setSyllabusTopics(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Separate distinct topics with commas for accurate curriculum matching.
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
                  {isSubmitting ? 'Saving...' : isEditing ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Course Confirmation Modal */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Delete Course</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete <span className="font-semibold text-gray-800">{courseToDelete.name} ({courseToDelete.course_id})</span>? This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCourse}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sample Data Confirmation Modal */}
      {isDeleteSampleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Delete Sample Data?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will remove all pre-loaded demonstration courses and reset course inventory.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteSampleConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSampleData}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
