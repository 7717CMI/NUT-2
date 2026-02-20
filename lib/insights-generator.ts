/**
 * Insights Generator
 * Automatically generates insights from filtered data
 */

import { DataRecord, FilterState } from './types'

export interface Insight {
  id: string
  type: 'growth' | 'leader' | 'trend' | 'comparison' | 'forecast'
  title: string
  description: string
  value?: string | number
  trend?: 'up' | 'down' | 'stable'
  priority: 'high' | 'medium' | 'low'
  icon?: string
}

/**
 * Generate insights from filtered data
 */
export function generateInsights(
  records: DataRecord[],
  filters: FilterState,
  currency: 'USD' | 'INR' = 'USD',
  volumeUnit: string = 'Million Units',
  valueUnit: string = 'Million'
): Insight[] {
  const insights: Insight[] = []

  if (records.length === 0) return insights

  // 1. Top Performer Analysis
  const topPerformer = findTopPerformer(records, filters, currency, volumeUnit, valueUnit)
  if (topPerformer) insights.push(topPerformer)

  // 2. Growth Leader
  const growthLeader = findGrowthLeader(records, filters)
  if (growthLeader) insights.push(growthLeader)

  // 3. Trend Analysis
  const trendInsight = analyzeTrends(records, filters)
  if (trendInsight) insights.push(trendInsight)

  // 4. Market Comparison
  const comparison = compareMarkets(records, filters)
  if (comparison) insights.push(comparison)

  // 5. Forecast Insight
  const forecast = generateForecast(records, filters)
  if (forecast) insights.push(forecast)

  // 6. Concentration Analysis
  const concentration = analyzeConcentration(records, filters)
  if (concentration) insights.push(concentration)

  return insights
}

/**
 * Find the top performing geography or segment
 */
function findTopPerformer(records: DataRecord[], filters: FilterState, currency: 'USD' | 'INR' = 'USD', volumeUnit: string = 'Million Units', valueUnit: string = 'Million'): Insight | null {
  const [, endYear] = filters.yearRange
  const currentYear = endYear

  // Group by geography or segment based on view mode
  const groupKey = filters.viewMode === 'segment-mode' ? 'segment' : 'geography'
  const grouped = new Map<string, number>()

  records.forEach(record => {
    const key = record[groupKey]
    const value = record.time_series[currentYear] || 0
    grouped.set(key, (grouped.get(key) || 0) + value)
  })

  // Find the top performer
  let topKey = ''
  let topValue = 0
  grouped.forEach((value, key) => {
    if (value > topValue) {
      topValue = value
      topKey = key
    }
  })

  if (!topKey) return null

  // Format value based on currency
  // Values in time_series are already in the unit specified by value_unit (e.g., "Million")
  // No additional division is needed
  let valueDisplay = ''
  if (filters.dataType === 'value') {
    if (currency === 'INR') {
      valueDisplay = `₹ ${topValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${valueUnit}`
    } else {
      valueDisplay = `${topValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ${valueUnit}`
    }
  } else {
    valueDisplay = `${topValue.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${volumeUnit}`
  }
  
  return {
    id: 'top-performer',
    type: 'leader',
    title: `${groupKey === 'geography' ? 'Leading Market' : 'Top Segment'}`,
    description: `${topKey} leads with ${valueDisplay} in ${currentYear}`,
    value: valueDisplay,
    trend: 'up',
    priority: 'high',
    icon: '🏆'
  }
}

/**
 * Find the fastest growing market
 */
function findGrowthLeader(records: DataRecord[], filters: FilterState): Insight | null {
  const [startYear, endYear] = filters.yearRange
  
  // Calculate growth rates
  const groupKey = filters.viewMode === 'segment-mode' ? 'segment' : 'geography'
  const growthRates = new Map<string, number>()
  
  // Group records by key
  const grouped = new Map<string, DataRecord[]>()
  records.forEach(record => {
    const key = record[groupKey]
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(record)
  })
  
  // Calculate growth for each group
  grouped.forEach((groupRecords, key) => {
    let startValue = 0
    let endValue = 0
    
    groupRecords.forEach(record => {
      startValue += record.time_series[startYear] || 0
      endValue += record.time_series[endYear] || 0
    })
    
    if (startValue > 0) {
      const growth = ((endValue - startValue) / startValue) * 100
      growthRates.set(key, growth)
    }
  })
  
  // Find highest growth
  let maxGrowthKey = ''
  let maxGrowth = -Infinity
  growthRates.forEach((growth, key) => {
    if (growth > maxGrowth) {
      maxGrowth = growth
      maxGrowthKey = key
    }
  })
  
  if (!maxGrowthKey || maxGrowth === -Infinity) return null
  
  const years = endYear - startYear
  const cagr = Math.pow((1 + maxGrowth / 100), 1 / years) - 1
  
  return {
    id: 'growth-leader',
    type: 'growth',
    title: 'Fastest Growing',
    description: `${maxGrowthKey} shows ${maxGrowth.toFixed(1)}% growth (${(cagr * 100).toFixed(1)}% CAGR)`,
    value: `${maxGrowth.toFixed(1)}%`,
    trend: maxGrowth > 0 ? 'up' : 'down',
    priority: 'high',
    icon: '📈'
  }
}

/**
 * Analyze overall trends
 */
function analyzeTrends(records: DataRecord[], filters: FilterState): Insight | null {
  const [startYear, endYear] = filters.yearRange
  const midYear = Math.floor((startYear + endYear) / 2)
  
  // Calculate total values for each period
  let earlyTotal = 0
  let midTotal = 0
  let lateTotal = 0
  
  records.forEach(record => {
    earlyTotal += record.time_series[startYear] || 0
    midTotal += record.time_series[midYear] || 0
    lateTotal += record.time_series[endYear] || 0
  })
  
  // Determine trend direction
  const firstHalfGrowth = midTotal > earlyTotal ? ((midTotal - earlyTotal) / earlyTotal) * 100 : 0
  const secondHalfGrowth = lateTotal > midTotal ? ((lateTotal - midTotal) / midTotal) * 100 : 0
  
  let trendDescription = ''
  let trend: 'up' | 'down' | 'stable' = 'stable'
  
  if (secondHalfGrowth > firstHalfGrowth * 1.2) {
    trendDescription = 'Accelerating growth trajectory'
    trend = 'up'
  } else if (secondHalfGrowth < firstHalfGrowth * 0.8) {
    trendDescription = 'Decelerating growth pattern'
    trend = 'down'
  } else {
    trendDescription = 'Steady growth momentum'
    trend = 'stable'
  }
  
  const overallGrowth = ((lateTotal - earlyTotal) / earlyTotal) * 100
  
  return {
    id: 'trend-analysis',
    type: 'trend',
    title: 'Market Trajectory',
    description: `${trendDescription} with ${overallGrowth.toFixed(1)}% total growth`,
    value: `${overallGrowth.toFixed(1)}%`,
    trend,
    priority: 'medium',
    icon: '📊'
  }
}

/**
 * Compare different markets
 */
function compareMarkets(records: DataRecord[], filters: FilterState): Insight | null {
  if (filters.viewMode !== 'matrix') return null
  
  const [, endYear] = filters.yearRange
  
  // Get unique geographies and segments
  const geographies = new Set<string>()
  const segments = new Set<string>()
  
  records.forEach(record => {
    geographies.add(record.geography)
    segments.add(record.segment)
  })
  
  if (geographies.size < 2 || segments.size < 2) return null
  
  // Find best combination
  let bestGeo = ''
  let bestSeg = ''
  let bestValue = 0
  
  records.forEach(record => {
    const value = record.time_series[endYear] || 0
    if (value > bestValue) {
      bestValue = value
      bestGeo = record.geography
      bestSeg = record.segment
    }
  })
  
  return {
    id: 'market-comparison',
    type: 'comparison',
    title: 'Optimal Market Mix',
    description: `${bestSeg} in ${bestGeo} represents the strongest opportunity`,
    value: bestValue,
    trend: 'up',
    priority: 'high',
    icon: '🎯'
  }
}

/**
 * Generate forecast insights
 */
function generateForecast(records: DataRecord[], filters: FilterState): Insight | null {
  const [, endYear] = filters.yearRange

  // Check if we're looking at future years
  const currentYear = new Date().getFullYear()
  if (endYear <= currentYear) return null
  
  // Calculate projected growth
  let historicalTotal = 0
  let futureTotal = 0
  
  records.forEach(record => {
    historicalTotal += record.time_series[Math.min(currentYear, endYear)] || 0
    futureTotal += record.time_series[endYear] || 0
  })
  
  const projectedGrowth = ((futureTotal - historicalTotal) / historicalTotal) * 100
  
  return {
    id: 'forecast',
    type: 'forecast',
    title: 'Future Outlook',
    description: `Market expected to ${projectedGrowth > 0 ? 'grow' : 'decline'} ${Math.abs(projectedGrowth).toFixed(1)}% by ${endYear}`,
    value: `${projectedGrowth > 0 ? '+' : ''}${projectedGrowth.toFixed(1)}%`,
    trend: projectedGrowth > 0 ? 'up' : 'down',
    priority: 'medium',
    icon: '🔮'
  }
}

/**
 * Analyze market concentration
 */
function analyzeConcentration(records: DataRecord[], filters: FilterState): Insight | null {
  const [, endYear] = filters.yearRange
  
  // Calculate total market value
  let totalValue = 0
  const values: number[] = []
  
  records.forEach(record => {
    const value = record.time_series[endYear] || 0
    totalValue += value
    if (value > 0) values.push(value)
  })
  
  if (values.length === 0) return null
  
  // Sort values in descending order
  values.sort((a, b) => b - a)
  
  // Calculate concentration (top 20% of records)
  const topCount = Math.ceil(values.length * 0.2)
  const topValue = values.slice(0, topCount).reduce((sum, v) => sum + v, 0)
  const concentration = (topValue / totalValue) * 100
  
  let description = ''
  let priority: 'high' | 'medium' | 'low' = 'medium'
  
  if (concentration > 80) {
    description = `Highly concentrated - top 20% accounts for ${concentration.toFixed(1)}% of market`
    priority = 'high'
  } else if (concentration > 60) {
    description = `Moderately concentrated - top 20% holds ${concentration.toFixed(1)}% share`
    priority = 'medium'
  } else {
    description = `Well distributed - top 20% represents ${concentration.toFixed(1)}% of market`
    priority = 'low'
  }
  
  return {
    id: 'concentration',
    type: 'comparison',
    title: 'Market Concentration',
    description,
    value: `${concentration.toFixed(1)}%`,
    trend: 'stable',
    priority,
    icon: '📍'
  }
}

/**
 * Find crossover points where one market overtakes another
 */
export function findCrossovers(
  records: DataRecord[],
  filters: FilterState
): Insight[] {
  const insights: Insight[] = []
  const [startYear, endYear] = filters.yearRange
  
  // Group by the comparison dimension
  const groupKey = filters.viewMode === 'segment-mode' ? 'segment' : 'geography'
  const groups = new Map<string, DataRecord[]>()
  
  records.forEach(record => {
    const key = record[groupKey]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(record)
  })
  
  // Compare pairs to find crossovers
  const keys = Array.from(groups.keys())
  
  for (let i = 0; i < keys.length - 1; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const key1 = keys[i]
      const key2 = keys[j]
      
      // Calculate totals for each year
      for (let year = startYear + 1; year <= endYear; year++) {
        const prevYear = year - 1
        
        let prevTotal1 = 0, prevTotal2 = 0
        let currTotal1 = 0, currTotal2 = 0
        
        groups.get(key1)!.forEach(r => {
          prevTotal1 += r.time_series[prevYear] || 0
          currTotal1 += r.time_series[year] || 0
        })
        
        groups.get(key2)!.forEach(r => {
          prevTotal2 += r.time_series[prevYear] || 0
          currTotal2 += r.time_series[year] || 0
        })
        
        // Check for crossover
        if ((prevTotal1 < prevTotal2 && currTotal1 > currTotal2) ||
            (prevTotal1 > prevTotal2 && currTotal1 < currTotal2)) {
          
          const overtaker = currTotal1 > currTotal2 ? key1 : key2
          const overtaken = currTotal1 > currTotal2 ? key2 : key1
          
          insights.push({
            id: `crossover-${year}-${i}-${j}`,
            type: 'trend',
            title: 'Market Shift',
            description: `${overtaker} overtakes ${overtaken} in ${year}`,
            value: year,
            trend: 'up',
            priority: 'high',
            icon: '🔄'
          })
        }
      }
    }
  }
  
  return insights
}
