import { isRepairOrderActiveToday } from '@/lib/dealershipDayBoundary';
import { normalizeExtractedData } from '@/utils/diagnosticParser';
import type { RepairOrder } from '@/types';

export const PREVIOUS_PAGE_SIZE = 25;
export const SEARCH_PAGE_SIZE = 50;

export function mergeRepairOrders(...lists: RepairOrder[][]): RepairOrder[] {
  const map = new Map<string, RepairOrder>();
  for (const list of lists) {
    for (const ro of list) {
      map.set(ro.id, ro);
    }
  }
  return Array.from(map.values());
}

export function matchesROSearch(ro: RepairOrder, term: string): boolean {
  const q = term.toLowerCase();
  return (
    ro.roNumber.toLowerCase().includes(q) ||
    (ro.vehicle.make?.toLowerCase().includes(q) ?? false) ||
    (ro.vehicle.model?.toLowerCase().includes(q) ?? false) ||
    (ro.vehicle.year?.includes(q) ?? false) ||
    (ro.vehicle.vin?.toLowerCase().includes(q) ?? false)
  );
}

export function sortRepairOrdersNewestFirst(orders: RepairOrder[]): RepairOrder[] {
  return [...orders].sort((a, b) =>
    (b.updatedAt || b.createdAt || '0') > (a.updatedAt || a.createdAt || '0') ? 1 : -1
  );
}

export function normalizeRepairOrder(repairOrder: RepairOrder): RepairOrder {
  return {
    ...repairOrder,
    repairLines: repairOrder.repairLines.map((line) => ({
      ...line,
      extractedData: normalizeExtractedData(line.extractedData),
    })),
  };
}

export function filterTodayRepairOrders(
  orders: RepairOrder[],
  todayStartIso: string | null
): RepairOrder[] {
  const active = todayStartIso
    ? orders.filter((ro) => isRepairOrderActiveToday(ro.updatedAt, todayStartIso, ro.createdAt))
    : orders;
  return sortRepairOrdersNewestFirst(active);
}