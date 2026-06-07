import type { StructuredROExtraction, VehicleInfo } from '../types';

export function extractComplaints(text: string): string[] {
  if (!text || text.trim().length < 6) return [];
  const comps: string[] = [];
  let cleaned = text.replace(/=== PAGE \d+ ===/g, '\n\n').replace(/\s+/g, ' ');
  const lines = cleaned.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  const TRIGGERS = [
    'customer states',
    'customer complaint',
    'customer concern',
    'customer reported',
    'customer states that',
    'technician notes',
    'tech notes',
    'technician found',
    'technician observed',
    'technician seen',
    'tech found',
    'tech observed',
    'concern',
    'complaint',
    'issue',
    'problem',
    'needs',
    'requires',
    'state inspection',
    'found',
    'observed',
    'reported',
    'requires repair',
    'inspection result',
    'c/s',
    'c s',
  ];

  const isJunk = (s: string) =>
    /^(vin|mile|km|ro\s*#|date|tech|name|model|customer|service|advisor|authorized|total|tax|parts|shop|dealer|labor|signature)/i.test(
      s
    );

  let collecting = false;
  let currentBlock = '';

  const flushBlock = () => {
    if (currentBlock.length < 8) return;
    const labeledMatches = currentBlock.match(/([A-D])[\.\)\:\s\-–—–—]+\s*([A-Za-z][^\.]{6,220})/gi) || [];
    if (labeledMatches.length > 0) {
      labeledMatches.forEach((m) => {
        let c = m.replace(/^[A-D][\.\)\:\s\-–—–—]+/i, '').trim();
        c = c.replace(/[\s\-–—–—]+$/, '');
        if (c.length > 6 && !isJunk(c) && !comps.includes(c)) comps.push(c);
      });
    } else {
      const parts = currentBlock
        .split(/[\.\!\?]\s+|\n|;/)
        .map((p) => p.trim())
        .filter((p) => p.length > 6);
      parts.forEach((p) => {
        if (!isJunk(p) && /[a-zA-Z]/.test(p) && p.length > 6 && !comps.includes(p)) {
          comps.push(p);
        }
      });
    }
    currentBlock = '';
  };

  for (const line of lines) {
    const lower = line.toLowerCase();
    const hitTrigger = TRIGGERS.some((t) => lower.includes(t));
    if (hitTrigger) {
      flushBlock();
      collecting = true;
      currentBlock = line + '. ';
      continue;
    }
    if (collecting) {
      if (
        /vin|ro\s*#|mileage|odometer|parts|labor|total|authorized|signature|print name|phone/i.test(lower) &&
        !lower.match(/complaint|concern|issue|problem/)
      ) {
        flushBlock();
        collecting = false;
        continue;
      }
      currentBlock += line + ' ';
    }
    const strayLabel = line.match(/^([A-D])[\.\)\:\s\-–—–—]+\s*(.+)$/i);
    if (strayLabel && strayLabel[2] && strayLabel[2].length > 6 && !isJunk(strayLabel[2])) {
      const c = strayLabel[2].trim();
      if (!comps.includes(c)) comps.push(c);
    }
  }
  flushBlock();

  if (comps.length < 2) {
    const globalPatterns = [
      /([A-D])[\.\)\:\s\-–—–—]+\s*([A-Za-z][^\n]{7,220})/gi,
      /(?:customer\s*states?|customer\s*complaint|technician\s*notes?|tech\s*notes?|technician\s*found|concern|complaint|issue|problem|needs|requires|found|observed)\s*[:\-]?\s*([A-Za-z][^\n]{7,220})/gi,
      /([A-D])\s*[\.\)]\s*([A-Za-z][^\n]{7,220})/gi,
    ];
    globalPatterns.forEach((p) => {
      let m;
      while ((m = p.exec(cleaned)) !== null) {
        const cand = (m[2] || m[1] || '').trim().replace(/[\s\-–—–—]+$/, '');
        if (cand.length > 6 && !isJunk(cand) && !comps.includes(cand) && /[a-z]/.test(cand)) {
          comps.push(cand);
        }
      }
    });
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of comps) {
    const key = c.toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
    if (!seen.has(key) && c.length > 5 && c.length < 280) {
      seen.add(key);
      unique.push(c.replace(/\s+/g, ' ').trim());
    }
  }
  return unique.slice(0, 10);
}

export function extractVehicleDetails(text: string): VehicleInfo {
  let cleaned = text
    .replace(/\bO\b/g, '0')
    .replace(/\bI\b/g, '1')
    .replace(/\bL\b/g, '1')
    .replace(/[\u2018\u2019]/g, "'");

  const topBlock = cleaned.substring(0, 500);
  const vinMatch = cleaned.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  let vin = vinMatch ? vinMatch[1] : '';
  if (vin) {
    vin = vin.toUpperCase().replace(/O/g, '0').replace(/I/g, '1').replace(/Q/g, '0').replace(/B/g, '8');
    if (!vin.match(/^[A-HJ-NPR-Z0-9]{17}$/)) vin = '';
  }

  const headerText = cleaned.substring(0, 600);
  let year = '';
  const myMatch =
    headerText.match(/\bM\.?Y\.?\s*(20\d{2}|19\d{2})\b/i) ||
    headerText.match(/\bModel\s*Year\s*(20\d{2}|19\d{2})\b/i) ||
    headerText.match(/\b(20\d{2}|19\d{2})\s*MY\b/i);
  if (myMatch) year = myMatch[1];
  if (!year) {
    const yearBefore = headerText.match(
      /\b(20\d{2}|19\d{2})\s+(?:Mercedes|Maybach|MB|GLE|GLS|GLC|GLA|S\s|E\s|C\s|EQ|AMG|GT|SL|CLS|CLA)\b/i
    );
    if (yearBefore) year = yearBefore[1];
  }
  if (!year) {
    const yearAny = headerText.match(/\b(20\d{2}|19\d{2})\b/);
    if (yearAny) year = yearAny[1];
  }

  let make = 'Mercedes-Benz';
  if (/Maybach/i.test(headerText)) make = 'Maybach';
  else if (/Mercedes[- ]?Benz/i.test(headerText) || /\bMercedes\b/i.test(headerText)) make = 'Mercedes-Benz';
  else if (/\bMB\b/i.test(headerText) || /\bMERCEDES\b/i.test(headerText)) make = 'Mercedes-Benz';
  else if (
    vin.startsWith('W1') ||
    vin.startsWith('WDD') ||
    vin.startsWith('WDC') ||
    vin.startsWith('WDF') ||
    vin.startsWith('W1N') ||
    vin.startsWith('W1K')
  ) {
    make = 'Mercedes-Benz';
  }

  let model = '';
  const modelPatterns = [
    /\b(Maybach\s+)?(?:GLE|GLS|GLC|GLA|GLB|G)\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|4M|AMG|Maybach|Coupe|SUV|Cabriolet))?\b/i,
    /\b(Maybach\s+)?S\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|AMG|Maybach|Maybach\s+S))?\b/i,
    /\b(Maybach\s+)?E\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|AMG))?\b/i,
    /\b(Maybach\s+)?C\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|AMG))?\b/i,
    /\b(?:EQE|EQS|EQB|EQC|EQ)\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|AMG))?\b/i,
    /\bAMG\s*(?:GT|SL|GLE|GLS|G)\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|AMG))?\b/i,
    /\b(?:CLS|CLA|SL|GT|ML|GL)\s*\d{2,3}[A-Z]?(?:\s*(?:4MATIC|AMG))?\b/i,
    /\b(?:Sprinter|Vito|Metris)\b/i,
  ];
  for (const re of modelPatterns) {
    const m = headerText.match(re);
    if (m) {
      model = m[0].replace(/\s+/g, ' ').trim();
      break;
    }
  }
  if (!model) {
    const generic = headerText.match(/\b(?:20\d{2}|19\d{2}|Mercedes|Maybach|MB)\s+([A-Z]{1,4}[\s-]?\d{2,3}[A-Z0-9\s-]{0,10})/i);
    if (generic && generic[1]) model = generic[1].trim();
  }
  model = model.replace(/\b4\s*MATIC\b/i, '4MATIC').replace(/\s+/g, ' ').trim();

  let mileageIn = '';
  const labeled = headerText.match(
    /(?:MILEAGE\s*IN|MILEAGE IN|mileage\s*in|odometer|current\s*(?:mile|km)|miles\s*in)\s*:?\s*([\d,]{3,7})/i
  );
  if (labeled) {
    mileageIn = labeled[1].replace(/,/g, '');
  } else {
    const any = cleaned.match(/([\d,]{4,7})\s*(?:mi|mile|miles|km)\b/i);
    if (any) mileageIn = any[1].replace(/,/g, '');
  }

  return { vin, year, make, model, mileageIn, mileageOut: '' };
}

export function extractCustomerName(text: string): string {
  const top = text.substring(0, 400);
  const patterns = [
    /customer\s*(?:name|:)?:?\s*([A-Z][A-Za-z'\-\s]{2,40})/i,
    /(?:name|owner)\s*:?\s*([A-Z][A-Za-z'\-\s]{2,40})/i,
    /^([A-Z][A-Za-z'\-\s]{2,30})\s*(?:RO|Repair|Vehicle|VIN)/im,
  ];
  for (const p of patterns) {
    const m = top.match(p) || text.match(p);
    if (m && m[1]) {
      const n = m[1].trim();
      if (n.length > 2 && n.length < 45 && !/vin|mile|ro|tech/i.test(n)) return n;
    }
  }
  return '';
}

export function parseStructuredROText(text: string): StructuredROExtraction {
  const vehicle: VehicleInfo = { vin: '', year: '', make: '', model: '', mileageIn: '', mileageOut: '' };
  let complaints: string[] = [];
  let customerName = '';
  let roNumber = '';

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let inComplaints = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('ro number:')) {
      roNumber = (line.split(':')[1] || '').trim();
    } else if (lower.startsWith('year:')) {
      vehicle.year = (line.split(':')[1] || '').trim();
    } else if (lower.startsWith('make:')) {
      vehicle.make = (line.split(':')[1] || '').trim();
    } else if (lower.startsWith('model:')) {
      vehicle.model = (line.split(':')[1] || '').trim();
    } else if (lower.startsWith('mileage in:')) {
      vehicle.mileageIn = (line.split(':')[1] || '').replace(/[^0-9]/g, '');
    } else if (lower.startsWith('vin:')) {
      vehicle.vin = (line.split(':')[1] || '').replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
    } else if (lower.startsWith('customer name:')) {
      customerName = (line.split(':')[1] || '').trim();
    } else if (lower.startsWith('customer complaints:')) {
      inComplaints = true;
      continue;
    }

    if (inComplaints) {
      if (/none listed/i.test(line)) {
        complaints = [];
        inComplaints = false;
        continue;
      }
      let m = line.match(/^([A-Z])[\.\)\:\s\-–—–—]+\s*(.+)$/i);
      if (!m) m = line.match(/^(\d{1,2})[\.\)\:\s\-–—–—]+\s*(.+)$/i);
      if (m && m[2]) {
        const c = m[2].trim();
        if (c.length > 4) complaints.push(c);
      } else if (line.length > 6 && !/^[A-Z]:/i.test(line)) {
        complaints.push(line);
      }
    }
  }

  if (!roNumber) {
    const m = text.match(/(?:RO Number|RO#|Repair Order|Work Order)[:\s#]*([A-Z0-9\-]{3,12})/i);
    if (m) roNumber = m[1];
  }
  if (!vehicle.vin) {
    const m = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (m) vehicle.vin = m[1].toUpperCase();
  }
  if (!vehicle.year) {
    const m = text.match(/\b(20\d{2}|19\d{2})\b/);
    if (m) vehicle.year = m[1];
  }
  if (!vehicle.make || vehicle.make === 'Mercedes-Benz') {
    if (/Maybach/i.test(text)) vehicle.make = 'Maybach';
    else if (/Mercedes/i.test(text)) vehicle.make = 'Mercedes-Benz';
  }
  if (!vehicle.model) {
    const m = text.match(/\b(GLE|GLS|GLC|GLA|S\s*\d|E\s*\d|C\s*\d|EQ[A-Z]?\s*\d|AMG)\s*\d{0,3}[A-Z]?(?:\s*4MATIC|AMG)?\b/i);
    if (m) vehicle.model = m[0].trim();
  }
  if (!vehicle.mileageIn) {
    const m = text.match(/(?:mileage in|odometer)[:\s]*([\d,]{3,7})/i);
    if (m) vehicle.mileageIn = m[1].replace(/,/g, '');
  }
  if (!customerName) {
    const m = text.match(/customer name[:\s]*([A-Z][A-Za-z'\-\s]{2,35})/i);
    if (m) customerName = m[1].trim();
  }

  const aggressive = extractComplaints(text);
  if (aggressive.length > complaints.length) {
    complaints = aggressive;
  }

  if (vehicle.vin && vehicle.vin.length !== 17) {
    vehicle.vin = vehicle.vin.replace(/[^A-HJ-NPR-Z0-9]/gi, '').slice(0, 17).toUpperCase();
  }
  vehicle.mileageIn = (vehicle.mileageIn || '').replace(/[^0-9]/g, '');
  complaints = complaints.filter((c) => c && c.trim().length > 5 && /[a-zA-Z]/.test(c));

  return { vehicle, complaints, customerName, roNumber };
}

export function extractRoNumberFromText(text: string): string {
  return (
    (text.match(/(?:^|\n)\s*(?:RO\s*#?|Repair\s*Order|Work\s*Order|RO#)\s*[:#]?\s*([A-Z0-9\-]{3,12})/im) || [])[1] ||
    (text.match(/(?:RO|Repair Order|Work Order)\s*[:#]?\s*([A-Z0-9\-]{3,12})/i) || [])[1] ||
    `R-${Date.now().toString().slice(-6)}`
  );
}

export function sanitizeComplaints(complaints: string[]): string[] {
  return complaints.filter((c) => c && c.trim().length > 5 && /[a-zA-Z]/.test(c));
}

export function sanitizeVehicle(vehicle: VehicleInfo): VehicleInfo {
  const v = { ...vehicle };
  if (v.vin && v.vin.length !== 17) {
    v.vin = v.vin.replace(/[^A-HJ-NPR-Z0-9]/gi, '').slice(0, 17).toUpperCase();
  }
  v.mileageIn = (v.mileageIn || '').replace(/[^0-9]/g, '');
  return v;
}