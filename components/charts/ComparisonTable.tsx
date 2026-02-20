'use client'

import { useMemo, useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { filterData } from '@/lib/data-processor'
import { ArrowUp, ArrowDown, Download } from 'lucide-react'

interface ComparisonTableProps {
  title?: string
  height?: number
}

export function ComparisonTable({ title, height = 600 }: ComparisonTableProps) {
  const { data, filters } = useDashboardStore()
  const [sortField, setSortField] = useState<string>('geography')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const tableData = useMemo(() => {
    if (!data) return []

    // Get the appropriate dataset
    const dataset = filters.dataType === 'value'
      ? data.data.value.geography_segment_matrix
      : data.data.volume.geography_segment_matrix

    // Filter data
    const filtered = filterData(dataset, filters)

    // Get the selected year (use base year or middle of range)
    const year = filters.yearRange[0] + Math.floor((filters.yearRange[1] - filters.yearRange[0]) / 2)
    const startYear = filters.yearRange[0]
    const endYear = filters.yearRange[1]

    // Calculate number of years for CAGR
    const years = endYear - startYear

    // Calculate total value across all filtered records for the display year to compute market share
    const totalValue = filtered.reduce((sum, record) => sum + (record.time_series[year] || 0), 0)

    // Transform to table format
    return filtered.map(record => {
      const sv = record.time_series[startYear] || 0
      const ev = record.time_series[endYear] || 0
      const currentVal = record.time_series[year] || 0
      const growth = sv > 0 ? ((ev - sv) / sv) * 100 : 0

      // Calculate CAGR from time_series data: CAGR = (endValue/startValue)^(1/years) - 1
      let cagr = 0
      if (sv > 0 && ev > 0 && years > 0) {
        cagr = (Math.pow(ev / sv, 1 / years) - 1) * 100
      }

      // Calculate market share as percentage of total filtered data for the display year
      const marketShare = totalValue > 0 ? (currentVal / totalValue) * 100 : 0

      return {
        geography: record.geography,
        segment: record.segment,
        segmentType: record.segment_type,
        currentValue: currentVal,
        startValue: sv,
        endValue: ev,
        growth,
        cagr,
        marketShare,
        sparkline: Object.entries(record.time_series)
          .filter(([y]) => parseInt(y) >= startYear && parseInt(y) <= endYear)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([, value]) => value)
      }
    })
  }, [data, filters])

  const sortedData = useMemo(() => {
    const sorted = [...tableData].sort((a, b) => {
      const aValue = a[sortField as keyof typeof a]
      const bValue = b[sortField as keyof typeof b]
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })
    return sorted
  }, [tableData, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const exportToCSV = () => {
    const headers = ['Geography', 'Segment', 'Type', 'Current Value', 'Growth %', 'CAGR %', 'Market Share %']
    const rows = sortedData.map(row => [
      row.geography,
      row.segment,
      row.segmentType,
      row.currentValue.toFixed(2),
      row.growth.toFixed(2),
      typeof row.cagr === 'number' ? row.cagr.toFixed(2) : '0.00',
      row.marketShare.toFixed(2)
    ])
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison-data-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const renderSparkline = (values: number[]) => {
    if (values.length === 0) return null
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1
    
    return (
      <div className="flex items-end h-8 gap-0.5">
        {values.map((value, i) => (
          <div
            key={i}
            className="flex-1 bg-blue-400 min-w-[3px] rounded-t"
            style={{
              height: `${((value - min) / range) * 100}%`,
              minHeight: '2px'
            }}
          />
        ))}
      </div>
    )
  }

  if (!data || tableData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-black">No data to display</p>
          <p className="text-sm text-black mt-1">
            Select filters to view the comparison table
          </p>
        </div>
      </div>
    )
  }

  const year = filters.yearRange[0] + Math.floor((filters.yearRange[1] - filters.yearRange[0]) / 2)
  const valueUnit = filters.dataType === 'value' 
    ? `${data.metadata.currency} ${data.metadata.value_unit}`
    : data.metadata.volume_unit

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-black">
            {title || 'Data Comparison Table'}
          </h3>
          <p className="text-sm text-black mt-1">
            Year: {year} | Values in {valueUnit}
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-auto border rounded-lg" style={{ maxHeight: height }}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-black uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('geography')}
              >
                <div className="flex items-center gap-1">
                  Geography
                  {sortField === 'geography' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-black uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('segment')}
              >
                <div className="flex items-center gap-1">
                  Segment
                  {sortField === 'segment' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                Type
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-black uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('currentValue')}
              >
                <div className="flex items-center justify-end gap-1">
                  Value
                  {sortField === 'currentValue' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-black uppercase tracking-wider">
                Trend
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-black uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('growth')}
              >
                <div className="flex items-center justify-end gap-1">
                  Growth %
                  {sortField === 'growth' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-black uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('cagr')}
              >
                <div className="flex items-center justify-end gap-1">
                  CAGR %
                  {sortField === 'cagr' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right text-xs font-medium text-black uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('marketShare')}
              >
                <div className="flex items-center justify-end gap-1">
                  Share %
                  {sortField === 'marketShare' && (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-black">
                  {row.geography}
                </td>
                <td className="px-4 py-3 text-sm text-black">
                  {row.segment}
                </td>
                <td className="px-4 py-3 text-sm text-black">
                  {row.segmentType}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-black">
                  {row.currentValue.toFixed(2)}
                </td>
                <td className="px-4 py-3 w-24">
                  {renderSparkline(row.sparkline)}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${
                  row.growth > 0 ? 'text-green-600' : row.growth < 0 ? 'text-red-600' : 'text-black'
                }`}>
                  {row.growth > 0 && '+'}{row.growth.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-sm text-right text-black">
                  {typeof row.cagr === 'number' ? row.cagr.toFixed(1) : '0.0'}%
                </td>
                <td className="px-4 py-3 text-sm text-right text-black">
                  {typeof row.marketShare === 'number' ? row.marketShare.toFixed(1) : '0.0'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-center text-sm text-black">
        Showing {sortedData.length} records | {filters.yearRange[0]} - {filters.yearRange[1]}
      </div>
    </div>
  )
}
