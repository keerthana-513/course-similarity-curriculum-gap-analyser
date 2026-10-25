export interface Course {
  id?: number;
  course_id: string;
  name: string;
  department: string;
  semester: string;
  description: string;
  syllabus_topics: string[] | string;
  created_at?: string;
  updated_at?: string;
}

export interface SimilarityPair {
  course1: string;
  course1_id?: string;
  course1_name: string;
  course2: string;
  course2_id?: string;
  course2_name: string;
  similarity: number;
  common_terms?: string[];
  is_high_overlap?: boolean;
}

export interface SimilarityAnalysisResult {
  id?: number;
  method: string;
  threshold: number;
  labels?: string[];
  course_labels?: string[];
  matrix?: number[][];
  similarity_matrix?: number[][];
  ranked_pairs?: SimilarityPair[];
  pairs?: SimilarityPair[];
  high_overlap_pairs?: SimilarityPair[];
  summary?: {
    total_courses: number;
    total_pairs: number;
    high_overlap_count: number;
    medium_overlap_count?: number;
    low_overlap_count?: number;
    execution_time_ms?: number;
  };
  created_at?: string;
}

export interface TopicCoverage {
  topic: string;
  status: 'covered' | 'partially_covered' | 'not_covered' | 'missing' | string;
  score?: number;
  covered_by?: Array<{ course_id: string; course_name: string; score?: number } | string>;
  matching_courses?: Array<{ course_id: string; course_name: string; score?: number } | string>;
}

export interface CourseCoverageSummary {
  course_id: string;
  course_name: string;
  covered_count: number;
  total_topics?: number;
}

export interface GapAnalysisResult {
  id?: number;
  curriculum_id: number;
  curriculum_name?: string;
  method?: string;
  coverage_summary?: {
    covered: number;
    partially_covered: number;
    not_covered?: number;
    missing?: number;
    total_topics: number;
    coverage_percentage: number;
  };
  topic_coverage?: TopicCoverage[];
  topics?: TopicCoverage[];
  course_coverage?: CourseCoverageSummary[];
  created_at?: string;
}

export interface Recommendation {
  id?: string | number;
  type: 'merge' | 'update' | 'split' | 'add_topic' | 'review' | string;
  priority: 'high' | 'medium' | 'low' | string;
  title?: string;
  related_courses: string[] | string;
  evidence: string;
  reason: string;
  suggested_action: string;
}

export interface AnalysisHistoryItem {
  id: number;
  analysis_type: 'similarity' | 'gap' | string;
  method?: string;
  parameters: Record<string, any>;
  results_summary?: any;
  summary?: any;
  results?: any;
  created_at: string;
}

export interface Curriculum {
  id: number;
  name: string;
  department: string;
  topics: string[] | string;
  created_at?: string;
}

export interface NlpStatus {
  tfidf_available?: boolean;
  semantic_available?: boolean;
  model_name?: string;
  device?: string;
  status?: string;
  [key: string]: any;
}

export interface HealthCheckResponse {
  status: string;
  version?: string;
  nlp?: NlpStatus;
}
