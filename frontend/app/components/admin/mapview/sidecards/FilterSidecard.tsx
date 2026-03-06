// app/components/mapview/FilterSidecard.tsx

"use client";

type FilterSidecardProps = {
  isOpen: boolean;
  hasSelection: boolean;
  selectedDeviceLabel: string;
  filterStart: string;
  filterEnd: string;
  isFiltering: boolean;
  filterError: string | null;
  onFilterStartChange: (value: string) => void;
  onFilterEndChange: (value: string) => void;
  onFilterRoute: () => void;
  onClearFilter: () => void;
  onClose: () => void;
};

export default function FilterSidecard({
  isOpen,
  hasSelection,
  selectedDeviceLabel,
  filterStart,
  filterEnd,
  isFiltering,
  filterError,
  onFilterStartChange,
  onFilterEndChange,
  onFilterRoute,
  onClearFilter,
  onClose,
}: FilterSidecardProps) {
  return (
    <aside className={`map-sidecard ${isOpen ? "is-open" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className="map-sidecard-header">
        <div className="map-sidecard-title">Filter Route</div>
        <button className="map-sidecard-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="map-sidecard-content">
        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Selected Device</div>
          <div className="map-sidecard-row">
            <span className="map-sidecard-label">Device</span>
            <span className="map-sidecard-value">
              {hasSelection ? selectedDeviceLabel : "Select a marker first."}
            </span>
          </div>
        </div>

        <div className="map-sidecard-section">
          <div className="map-sidecard-section-title">Date Range</div>
          <label className="map-sidecard-input-label" htmlFor="filter-start">
            Start
          </label>
          <input
            id="filter-start"
            className="map-sidecard-input"
            type="datetime-local"
            value={filterStart}
            onChange={(event) => onFilterStartChange(event.target.value)}
          />
          <label className="map-sidecard-input-label" htmlFor="filter-end">
            End
          </label>
          <input
            id="filter-end"
            className="map-sidecard-input"
            type="datetime-local"
            value={filterEnd}
            onChange={(event) => onFilterEndChange(event.target.value)}
          />

          {filterError && <div className="map-sidecard-error">{filterError}</div>}

          <div className="map-sidecard-filter-actions">
            <button
              className="map-footer-action is-primary"
              onClick={onFilterRoute}
              disabled={!hasSelection || !filterStart || !filterEnd || isFiltering}
            >
              {isFiltering ? "Filtering..." : "Filter Route"}
            </button>
            <button className="map-footer-action is-secondary" onClick={onClearFilter}>
              Clear Filter
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
