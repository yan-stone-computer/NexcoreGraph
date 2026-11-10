import { IntakeResult } from './Db';

export class ScanEvidence {
  code: string = '';
  format: string = '';
  at: number = 0;
}

/**
 * Attach an exact scan code only when recognition produced exactly one item.
 * A code must never be assigned by guessing which item it belongs to.
 */
export function attachScanEvidence(items: IntakeResult[], scan: ScanEvidence): IntakeResult[] {
  const output: IntakeResult[] = items.slice();
  if (scan.code === '' || output.length !== 1) {
    return output;
  }
  output[0].barcode = scan.code;
  output[0].barcodeSource = '扫码';
  return output;
}
