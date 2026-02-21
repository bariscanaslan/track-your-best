// app/components/mapview/StatisticsSidecard.tsx

"use client";

type StatisticsSidecardProps = {
  isOpen: boolean;
  routePointCount: number;
  hasApprovedRoute: boolean;
  activeTripStatus: string | null;
  onClose: () => void;
};

export default function StatisticsSidecard({
  isOpen,
  routePointCount,
  hasApprovedRoute,
  activeTripStatus,
  onClose,
}: StatisticsSidecardProps) {
  return (
    <aside className={`map-sidecard ${isOpen ? "is-open" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className="map-sidecard-header">
        <div className="map-sidecard-title">Statistics</div>
        <button className="map-sidecard-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="map-sidecard-content">
        <div className="map-sidecard-row">
          <span className="map-sidecard-label">Current Route Points</span>
          <span className="map-sidecard-value">{routePointCount}</span>
        </div>
        <div className="map-sidecard-row">
          <span className="map-sidecard-label">Approval Status</span>
          <span className="map-sidecard-value">{hasApprovedRoute ? "Approved" : "Not approved"}</span>
        </div>
        <div className="map-sidecard-row">
          <span className="map-sidecard-label">Active Trip Status</span>
          <span className="map-sidecard-value">{activeTripStatus ?? "No active trip"}</span>
        </div>
      </div>
    </aside>
  );
}
