'use client'

import { useState } from 'react'
import ChangeRequestTable from '@/components/ChangeRequestTable'
import ChangeRequestFilters from '@/components/ChangeRequestFilters'

interface FilterOptions {
  search: string
  status: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10
  })

  const [changeRequests, setChangeRequests] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalPages, setTotalPages] = useState(1)

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    // TODO: Fetch data with new filters
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <div className="space-y-4">
        <ChangeRequestFilters
          filters={filters}
          onFilterChange={handleFilterChange}
        />
        <ChangeRequestTable
          changeRequests={changeRequests}
          isLoading={isLoading}
          filters={filters}
          totalPages={totalPages}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  )
} 