import { WeightUnit } from "../types/database";

/**
 * Returns formatted unit string (lbs or kg).
 */
export function getUnitLabel(unit?: WeightUnit | null): string {
  return unit === "kg" ? "kg" : "lbs";
}

/**
 * Formats a weight value with its unit suffix.
 */
export function formatWeightWithUnit(
  weight: number | string | null | undefined,
  unit?: WeightUnit | null
): string {
  if (weight === null || weight === undefined || weight === "") {
    return "-";
  }
  const num = typeof weight === "number" ? weight : parseFloat(weight);
  if (isNaN(num)) return "-";
  return `${num} ${getUnitLabel(unit)}`;
}
