import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { scanCommand } from '../../src/cli/commands/scan.ts';
import { optimizeCommand } from '../../src/cli/commands/optimize.ts';

// Utility to deep copy a directory (Node 16+)
async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = await fsp.readlink(srcPath);
      await fsp.symlink(link, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

// Utility to gather file hashes (for immutability checks)
import crypto from 'crypto';
async function hashDirectory(dir) {
  const hashes = {};
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const data = await fsp.readFile(full);
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        hashes[path.relative(dir, full)] = hash;
      }
    }
  }
  await walk(dir);
  return hashes;
}

// Capture console.log output while executing a function
async function captureLogs(fn) {
  const originalLog = console.log;
  const buffer = [];
  console.log = (...args) => {
    buffer.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  try {
    await fn();
  } finally {
    console.log = originalLog;
  }
  return buffer;
}

// Extract JSON payload from logs (first valid JSON encountered)
function extractJson(logLines) {
  for (const line of logLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        /* ignore */
      }
    }
  }
  return [];
}

export class ComponentTestRunner {
  constructor() {
    this.testCases = [];
  }

  async loadTestCases() {
    const sitesModule = await import('../config/sites.config.js');
    this.testCases = sitesModule.default || sitesModule.testSites || [];
  }

  async runTests() {
    const results = [];
    const summary = {
      total: this.testCases.length,
      passed: 0,
      failed: 0,
      issuesFound: 0,
      issuesFixed: 0,
    };

    for (const testCase of this.testCases) {
      const res = await this.runSingleTest(testCase);
      results.push(res);
      if (res.success) summary.passed += 1;
      else summary.failed += 1;
      summary.issuesFound += res.foundIssues.length;
      summary.issuesFixed += res.fixedIssues.length;
    }

    return {
      success: summary.failed === 0,
      summary,
      results,
    };
  }

  async runSingleTest(testCase) {
    const start = Date.now();
    let tempDir;
    let success = false;
    let foundIssues = [];
    let fixedIssues = [];
    const verificationResults = { before: [], after: [] };
    let error = null;

    try {
      const fixturesRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '__fixtures__');
      const siteSrc = path.join(fixturesRoot, testCase.path.replace('__fixtures__', '').replace(/^\/+/, ''));

      // Verify source exists
      if (!fs.existsSync(siteSrc)) {
        throw new Error(`Fixture not found: ${siteSrc}`);
      }

      tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `cliseo-test-${testCase.name}-`));
      await copyDir(siteSrc, tempDir);

      const originalHashes = await hashDirectory(siteSrc);

      // Pre-scan
      const preLogs = await captureLogs(async () => {
        const cwdBefore = process.cwd();
        process.chdir(tempDir);
        await scanCommand({ json: true });
        process.chdir(cwdBefore);
      });
      const preRaw = extractJson(preLogs);
      foundIssues = preRaw.flatMap(r => Array.isArray(r.issues) ? r.issues : [])
        .map(iss => ({ ...iss, description: iss.description || iss.message }));

      // optimisation step
      const cwdBackup = process.cwd();
      process.chdir(tempDir);
      await optimizeCommand();
      process.chdir(cwdBackup);

      // Post-scan
      const postLogs = await captureLogs(async () => {
        const cwd2 = process.cwd();
        process.chdir(tempDir);
        await scanCommand({ json: true });
        process.chdir(cwd2);
      });
      const postRaw = extractJson(postLogs);
      const postIssues = postRaw.flatMap(r => Array.isArray(r.issues) ? r.issues : []);

      // Determine fixed issues (rudimentary by comparing message+type+file)
      const stringifyIssue = (iss) => `${iss.type}-${iss.message || iss.description || ''}-${iss.file || ''}`;
      const preSet = new Set(foundIssues.map(stringifyIssue));
      const postSet = new Set(postIssues.map(stringifyIssue));
      fixedIssues = [...preSet]
        .filter((s) => !postSet.has(s))
        .map((s) => ({ type: 'fixed', description: s }));

      success = fixedIssues.length > 0 && postIssues.length < foundIssues.length;

      // Verify original fixtures unchanged
      const afterHashes = await hashDirectory(siteSrc);
      for (const [file, hash] of Object.entries(originalHashes)) {
        if (afterHashes[file] !== hash) {
          throw new Error(`Original fixture modified: ${file}`);
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const duration = Date.now() - start;

    return {
      testCase,
      success,
      duration,
      foundIssues,
      fixedIssues,
      verificationResults,
      error,
    };
  }
} 