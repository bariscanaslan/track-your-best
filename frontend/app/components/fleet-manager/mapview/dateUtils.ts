export function formatToGMT3(timestamp?: string | null) {
  if (!timestamp) {
    return "Unknown";
  }

  const dateUTC = new Date(timestamp);

  // UTC +3 offset
  const gmt3 = new Date(dateUTC.getTime() + 6 * 60 * 60 * 1000);

  const year = gmt3.getUTCFullYear();
  const month = String(gmt3.getUTCMonth() + 1).padStart(2, "0");
  const day = String(gmt3.getUTCDate()).padStart(2, "0");

  const hours = String(gmt3.getUTCHours()).padStart(2, "0");
  const minutes = String(gmt3.getUTCMinutes()).padStart(2, "0");
  const seconds = String(gmt3.getUTCSeconds()).padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds} (GMT+3)`;
}
