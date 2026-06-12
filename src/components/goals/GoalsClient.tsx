'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
import { YearView } from './YearView'

interface Props {
  data: GoalsPageData
}

export function GoalsClient({ data }: Props) {
  const { years, byYear } = data
  const [selectedYear, setSelectedYear] = useState(years[0])
  const currentIndex = years.indexOf(selectedYear)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goals & PBs</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{selectedYear} season</p>
        </div>
        {years.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedYear(years[currentIndex + 1])}
              disabled={currentIndex >= years.length - 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
                    y === selectedYear
                      ? 'bg-emerald-500 text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedYear(years[currentIndex - 1])}
              disabled={currentIndex <= 0}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <YearView yearData={byYear[selectedYear]} />
    </div>
  )
}
