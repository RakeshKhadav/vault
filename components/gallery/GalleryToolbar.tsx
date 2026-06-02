import React, { useState } from 'react'

export interface GalleryToolbarProps {
  searchPlaceholder?: string
  searchQuery: string
  setSearchQuery: (val: string) => void
  typeFilter: 'all' | 'image' | 'video'
  onTypeFilterChange: (type: 'all' | 'image' | 'video') => void
  datePreset: 'anytime' | 'today' | 'week' | 'month' | 'year'
  onDatePresetChange: (preset: 'anytime' | 'today' | 'week' | 'month' | 'year') => void
  extraActions?: React.ReactNode
}

export const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  searchPlaceholder = 'Search media...',
  searchQuery,
  setSearchQuery,
  typeFilter,
  onTypeFilterChange,
  datePreset,
  onDatePresetChange,
  extraActions,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="gallery-toolbar">
      <div className="search-wrapper">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Small filters toggle button on mobile */}
      <button
        className={`filter-toggle-btn ${filtersOpen ? 'active' : ''}`}
        onClick={() => setFiltersOpen(!filtersOpen)}
        aria-label="Toggle filters"
      >
        🎛️ Filters
      </button>

      <div className={`gallery-filters-collapsible ${filtersOpen ? 'open' : ''}`}>
        <div className="toolbar-divider" />

        <div className="filter-tabs">
          <button
            className={`filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => onTypeFilterChange('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${typeFilter === 'image' ? 'active' : ''}`}
            onClick={() => onTypeFilterChange('image')}
          >
            Photos
          </button>
          <button
            className={`filter-tab ${typeFilter === 'video' ? 'active' : ''}`}
            onClick={() => onTypeFilterChange('video')}
          >
            Videos
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="date-presets">
          {(['anytime', 'today', 'week', 'month', 'year'] as const).map((preset) => (
            <button
              key={preset}
              className={`preset-tab ${datePreset === preset ? 'active' : ''}`}
              onClick={() => onDatePresetChange(preset)}
            >
              {preset === 'anytime' ? 'Anytime' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset === 'year' ? 'This Year' : 'Today'}
            </button>
          ))}
        </div>
      </div>

      {extraActions && (
        <>
          <div className="toolbar-divider" />
          {extraActions}
        </>
      )}
    </div>
  )
}
