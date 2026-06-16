export function humanStatus(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase().replace(/[_\s]/g, "")) {
    case "driverapprove":   return "Awaiting Driver Approval";
    case "ongoing":         return "In Progress";
    case "paused":          return "Paused";
    case "completed":       return "Completed";
    case "cancelledfm":     return "Cancelled by Fleet Manager";
    case "cancelleddriver": return "Cancelled by Driver";
    default:                return "Unknown";
  }
}
