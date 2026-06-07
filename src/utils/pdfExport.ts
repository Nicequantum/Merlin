import { jsPDF } from 'jspdf';
import type { RepairLine, RepairOrder } from '@/types';

export function exportWarrantyStoryPdf(ro: RepairOrder, line: RepairLine): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const ln of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(ln, margin, y);
      y += size * 1.35;
    }
  };

  addText('Benz Tech — Warranty Story', 14, 'bold');
  y += 4;
  addText(`RO: ${ro.roNumber}`, 10);
  addText(
    `Vehicle: ${[ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(' ')} | VIN: ${ro.vehicle.vin}`,
    10
  );
  if (ro.vehicle.engine) addText(`Engine: ${ro.vehicle.engine}`, 10);
  if (ro.vehicle.mileageIn) addText(`Mileage In: ${ro.vehicle.mileageIn}`, 10);
  addText(`Line ${line.lineNumber}: ${line.description}`, 10, 'bold');
  y += 8;
  addText('WARRANTY STORY', 11, 'bold');
  y += 4;
  addText(line.warrantyStory || '', 10);
  y += 12;
  addText(`Generated: ${new Date().toLocaleString()}`, 8);
  addText('Audit-safe documentation — facts from documented RO and diagnostic data only.', 8);

  doc.save(`warranty-story-${ro.roNumber}-line${line.lineNumber}.pdf`);
}

export async function copyFormattedStory(ro: RepairOrder, line: RepairLine): Promise<void> {
  const vehicle = [ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(' ');
  const header = [
    `RO: ${ro.roNumber}`,
    `Vehicle: ${vehicle}`,
    ro.vehicle.vin ? `VIN: ${ro.vehicle.vin}` : '',
    ro.vehicle.engine ? `Engine: ${ro.vehicle.engine}` : '',
    ro.vehicle.mileageIn ? `Mileage In: ${ro.vehicle.mileageIn}` : '',
    `Line ${line.lineNumber}: ${line.description}`,
    '',
    '--- WARRANTY STORY ---',
    '',
  ]
    .filter(Boolean)
    .join('\n');

  await navigator.clipboard.writeText(header + (line.warrantyStory || ''));
}