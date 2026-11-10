import { describe, expect, it } from '@ohos/hypium';
import { attachScanEvidence, ScanEvidence } from '../main/ets/common/BarcodeIntake';
import { IntakeResult } from '../main/ets/common/Db';

function item(name: string): IntakeResult {
  return new IntakeResult('1', '📦', '', name, '', '1', '个', '', '', 0, '', '', 'AI', false);
}

function evidence(code: string): ScanEvidence {
  const value = new ScanEvidence();
  value.code = code;
  value.format = 'EAN-13';
  value.at = 1;
  return value;
}

export default function barcodeIntakeTest() {
  describe('barcodeIntake', () => {
    it('attaches an exact code when recognition has one item', 0, () => {
      const input: IntakeResult[] = [item('牛奶')];
      const output = attachScanEvidence(input, evidence('6900000000001'));
      expect(output[0].barcode).assertEqual('6900000000001');
      expect(output[0].barcodeSource).assertEqual('扫码');
    });

    it('does not guess which item owns a code when several were recognized', 0, () => {
      const output = attachScanEvidence([item('牛奶'), item('鸡蛋')], evidence('6900000000001'));
      expect(output[0].barcode).assertEqual('');
      expect(output[1].barcode).assertEqual('');
    });

    it('leaves recognition data unchanged when the scan was cancelled', 0, () => {
      const input: IntakeResult[] = [item('牛奶')];
      const output = attachScanEvidence(input, evidence(''));
      expect(output[0].barcode).assertEqual('');
    });
  });
}
