'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertCircle, Lightbulb, Target } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'
import { filterData } from '@/lib/data-processor'
import { generateInsights, findCrossovers, type Insight } from '@/lib/insights-generator'

export function InsightsPanel() {
  const { data, filters, currency } = useDashboardStore()

  const insights = useMemo(() => {
    if (!data) return []

    const dataset = filters.dataType === 'value'
      ? data.data.value.geography_segment_matrix
      : data.data.volume.geography_segment_matrix

    const filtered = filterData(dataset, filters)
    
    // Generate main insights
    const mainInsights = generateInsights(filtered, filters, currency || 'USD', data.metadata.volume_unit || 'Million Units', data.metadata.value_unit || 'Million')
    
    // Find crossover points
    const crossovers = findCrossovers(filtered, filters)
    
    // Combine and sort by priority
    const allInsights = [...mainInsights, ...crossovers].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    
    // Limit to top 6 insights
    return allInsights.slice(0, 6)
  }, [data, filters, currency])

  if (!data || insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Lightbulb className="h-12 w-12 text-black mb-4" />
        <p className="text-black text-center">
          No insights available yet
        </p>
        <p className="text-black text-sm text-center mt-2">
          Select filters to generate automatic insights
        </p>
      </div>
    )
  }

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'stable':
        return <Minus className="h-4 w-4 text-black" />
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />
    }
  }

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200'
      case 'low':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getTypeIcon = (type: Insight['type']) => {
    switch (type) {
      case 'growth':
        return '📈'
      case 'leader':
        return '🏆'
      case 'trend':
        return '📊'
      case 'comparison':
        return '⚖️'
      case 'forecast':
        return '🔮'
      default:
        return '💡'
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            data-insight="true"
            className={`p-4 rounded-lg border transition-all hover:shadow-md ${getPriorityColor(insight.priority)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" role="img" aria-label={insight.type}>
                {insight.icon || getTypeIcon(insight.type)}
              </span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-black" data-insight-title="true">
                    {insight.title}
                  </h4>
                  {getTrendIcon(insight.trend)}
                  {insight.priority === 'high' && (
                    <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                      Important
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-black" data-insight-description="true">
                  {insight.description}
                </p>
                
                {insight.value && (
                  <div className="mt-2 inline-flex items-center gap-2">
                    <Target className="h-3 w-3 text-black" />
                    <span className="text-sm font-semibold text-black">
                      {typeof insight.value === 'number' 
                        ? insight.value.toLocaleString() 
                        : insight.value}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-black flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Insights are automatically generated based on current filters and may vary with different selections
          </p>
        </div>
      )}
    </div>
  )
}
