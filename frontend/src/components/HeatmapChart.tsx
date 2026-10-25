import React, { useState } from 'react';

interface HeatmapChartProps {
  matrix?: number[][];
  labels?: string[];
  title?: string;
  subtitle?: string;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  matrix = [],
  labels = [],
  title = 'Course Similarity Heatmap',
  subtitle = 'Pairwise similarity score matrix between course syllabi',
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    val: number;
    x: number;
    y: number;
  } | null>(null);

  if (!matrix || matrix.length === 0 || !labels || labels.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm text-center">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">No similarity data available to display</p>
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-sm text-gray-400">Run similarity analysis to generate heatmap</p>
        </div>
      </div>
    );
  }

  // Helper function to get color based on similarity score (0.0 to 1.0)
  const getCellColor = (value: number, isDiagonal: boolean) => {
    if (isDiagonal) {
      return {
        backgroundColor: '#4338CA', // Indigo-700 for identity
        textColor: '#FFFFFF',
      };
    }
    if (value >= 0.7) {
      return {
        backgroundColor: '#DC2626', // Red-600
        textColor: '#FFFFFF',
      };
    }
    if (value >= 0.5) {
      return {
        backgroundColor: '#F97316', // Orange-500
        textColor: '#FFFFFF',
      };
    }
    if (value >= 0.3) {
      return {
        backgroundColor: '#FBBF24', // Amber-400
        textColor: '#1F2937',
      };
    }
    if (value >= 0.15) {
      return {
        backgroundColor: '#A7F3D0', // Emerald-200
        textColor: '#064E3B',
      };
    }
    if (value > 0) {
      return {
        backgroundColor: '#ECFDF5', // Emerald-50
        textColor: '#065F46',
      };
    }
    return {
      backgroundColor: '#F9FAFB', // Gray-50
      textColor: '#9CA3AF',
    };
  };

  const truncateLabel = (label: string, maxLength: number = 18) => {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 3) + '...';
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 sm:mt-0 flex-wrap text-xs">
          <span className="text-gray-500 font-medium">Similarity:</span>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-100"></span>
            <span className="text-gray-600">&lt; 0.15</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-emerald-200"></span>
            <span className="text-gray-600">0.15 - 0.3</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-amber-400"></span>
            <span className="text-gray-600">0.3 - 0.5</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-orange-500"></span>
            <span className="text-gray-600">0.5 - 0.7</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-red-600"></span>
            <span className="text-gray-600">&gt;= 0.7</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-indigo-700"></span>
            <span className="text-gray-600">1.0 (Self)</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Container */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-block min-w-full align-middle">
          <table className="border-collapse table-fixed">
            <thead>
              <tr>
                <th className="w-36 min-w-36 p-1.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-white z-10 border-b border-r border-gray-200">
                  Course
                </th>
                {labels.map((colLabel, colIndex) => (
                  <th
                    key={colIndex}
                    title={colLabel}
                    className="w-14 min-w-14 h-24 p-1 text-center align-bottom border-b border-gray-200"
                  >
                    <div className="transform -rotate-45 origin-bottom-left text-xs font-medium text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis w-20 translate-x-2">
                      {truncateLabel(colLabel, 14)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, rowIndex) => {
                const rowLabel = labels[rowIndex] || `Course ${rowIndex + 1}`;
                return (
                  <tr key={rowIndex} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td
                      title={rowLabel}
                      className="w-36 min-w-36 p-1.5 text-xs font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {truncateLabel(rowLabel, 18)}
                    </td>
                    {row.map((val, colIndex) => {
                      const isDiagonal = rowIndex === colIndex;
                      const { backgroundColor, textColor } = getCellColor(val, isDiagonal);
                      return (
                        <td
                          key={colIndex}
                          className="w-14 min-w-14 h-10 p-0 text-center relative group transition-transform"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              row: rowIndex,
                              col: colIndex,
                              val,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className="w-full h-10 flex items-center justify-center text-xs font-semibold rounded cursor-pointer transition-all hover:scale-110 hover:shadow-md hover:z-20 relative m-0.5"
                            style={{
                              backgroundColor,
                              color: textColor,
                            }}
                          >
                            {(val * 100).toFixed(0)}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 8}px`,
          }}
        >
          <div className="font-semibold text-indigo-300">
            {(hoveredCell.val * 100).toFixed(1)}% Similarity
          </div>
          <div className="mt-1 text-gray-200">
            <span className="text-gray-400">Row:</span> {labels[hoveredCell.row]}
          </div>
          <div className="text-gray-200">
            <span className="text-gray-400">Col:</span> {labels[hoveredCell.col]}
          </div>
          {hoveredCell.row === hoveredCell.col && (
            <div className="mt-0.5 text-emerald-400 font-medium">Self-comparison (100%)</div>
          )}
          {hoveredCell.val >= 0.6 && hoveredCell.row !== hoveredCell.col && (
            <div className="mt-0.5 text-rose-400 font-medium">High Overlap Warning</div>
          )}
        </div>
      )}
    </div>
  );
};

export default HeatmapChart;
