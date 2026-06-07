export interface VinDecodeResult {
  vin: string;
  year: string;
  make: string;
  model: string;
  engine: string;
  trim: string;
  bodyClass: string;
  driveType: string;
  fuelType: string;
  valid: boolean;
}

function pickValue(results: Array<{ Variable: string; Value: string | null }>, variable: string): string {
  const item = results.find((r) => r.Variable === variable);
  return item?.Value?.trim() || '';
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const cleaned = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 17) {
    return { vin: cleaned, year: '', make: '', model: '', engine: '', trim: '', bodyClass: '', driveType: '', fuelType: '', valid: false };
  }

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${cleaned}?format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`NHTSA VIN API error: ${res.status}`);

  const data = await res.json();
  const results: Array<{ Variable: string; Value: string | null }> = data.Results || [];

  const errorCode = pickValue(results, 'Error Code');
  const valid = !errorCode.startsWith('1') && !errorCode.startsWith('2');

  const year = pickValue(results, 'Model Year');
  const make = pickValue(results, 'Make');
  const model = pickValue(results, 'Model');
  const trim = pickValue(results, 'Trim');
  const bodyClass = pickValue(results, 'Body Class');
  const driveType = pickValue(results, 'Drive Type');
  const fuelType = pickValue(results, 'Fuel Type - Primary');

  const displacement = pickValue(results, 'Displacement (L)');
  const cylinders = pickValue(results, 'Engine Number of Cylinders');
  const engineModel = pickValue(results, 'Engine Model');
  const engineParts = [displacement ? `${displacement}L` : '', cylinders ? `${cylinders}-cyl` : '', engineModel].filter(Boolean);
  const engine = engineParts.join(' ').trim();

  return { vin: cleaned, year, make, model, engine, trim, bodyClass, driveType, fuelType, valid };
}