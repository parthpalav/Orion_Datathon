// Fuel use per km from average speed, using the UK Department for Transport formula
//   L/km = a/v + b + c·v + d·v²   (v in km/h, clamped to 10–130 km/h)
// Source: DfT TAG data book v1.18, Table A1.3.8, petrol car, 2015 values.
// shortcut: UK petrol fleet curve, not an Indian one; swap in ARAI/CPCB-based values if a cited Indian curve turns up.
const A = 0.45195;
const B = 0.09605;
const C = -0.00109;
const D = 0.000007;
const MIN_KMH = 10;
const MAX_KMH = 130;

// Tank-to-exhaust CO₂ for petrol, kg per litre.
export const CO2_KG_PER_LITRE = 2.31;

export function litresPerKm(speedKmh: number): number {
  const v = Math.min(MAX_KMH, Math.max(MIN_KMH, speedKmh || MIN_KMH));
  return A / v + B + C * v + D * v * v;
}

/** Sums fuel over route segments. speeds in m/s and distances in metres, as Mapbox annotations give them. */
export function routeFuel(speedsMs: number[], distancesM: number[]): { litres: number; co2Kg: number } {
  let litres = 0;
  for (let i = 0; i < distancesM.length; i++) {
    litres += (distancesM[i] / 1000) * litresPerKm((speedsMs[i] ?? 0) * 3.6);
  }
  return { litres, co2Kg: litres * CO2_KG_PER_LITRE };
}
