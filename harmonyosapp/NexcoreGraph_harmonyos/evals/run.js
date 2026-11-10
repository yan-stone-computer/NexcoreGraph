'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeModelReply } = require('../backend/replySanitizer');
const { findUngroundedNumbers } = require('../backend/groundedness');

const root = __dirname;
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputPath = outIndex >= 0 && args[outIndex + 1]
  ? path.resolve(process.cwd(), args[outIndex + 1])
  : path.join(root, 'result.json');

function runSanitize(testCase) {
  const actual = sanitizeModelReply(testCase.input);
  return {
    pass: actual === testCase.expected,
    expected: testCase.expected,
    actual
  };
}

function runGrounding(testCase) {
  const actual = findUngroundedNumbers(testCase.reply, testCase.evidence)
    .map((item) => item.token);
  return {
    pass: JSON.stringify(actual) === JSON.stringify(testCase.expected),
    expected: testCase.expected,
    actual
  };
}

function main() {
  const cases = JSON.parse(fs.readFileSync(path.join(root, 'cases.json'), 'utf8'));
  const results = cases.map((testCase) => {
    const result = testCase.category === 'sanitize'
      ? runSanitize(testCase)
      : runGrounding(testCase);
    return {
      id: testCase.id,
      category: testCase.category,
      pass: result.pass,
      expected: result.expected,
      actual: result.actual
    };
  });
  const failures = results.filter((result) => !result.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'offline-deterministic',
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    hardFailViolations: failures.length,
    categories: {
      sanitize: {
        total: results.filter((r) => r.category === 'sanitize').length,
        failed: results.filter((r) => r.category === 'sanitize' && !r.pass).length
      },
      grounding: {
        total: results.filter((r) => r.category === 'grounding').length,
        failed: results.filter((r) => r.category === 'grounding' && !r.pass).length
      }
    },
    failures,
    results
  };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`GuardrailBench: ${report.passed}/${report.total} passed, ${report.failed} failed`);
  console.log(`Report: ${outputPath}`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main();
