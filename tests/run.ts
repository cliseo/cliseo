import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

// ESM-friendly __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

type Framework = 'react' | 'next' | 'angular';

interface FixtureInfo {
  framework: Framework;
  fixtureDir: string;
}

interface TestResult {
  framework: Framework;
  fixtureDir: string;
  tempDir: string;
  preScan: any;
  optimization: any;
  postScan: any;
  build: {
    success: boolean;
    error?: string;
  };
  functionality: {
  success: boolean;
  error?: string;
  };
}

const FIXTURES: FixtureInfo[] = [
  {
    framework: 'react',
    fixtureDir: path.resolve(__dirname, '__fixtures__', 'react-app'),
  },
  {
    framework: 'next',
    fixtureDir: path.resolve(__dirname, '__fixtures__', 'next-app'),
  },
  {
    framework: 'angular',
    fixtureDir: path.resolve(__dirname, '__fixtures__', 'angular-app'),
  },
];

const frameworkArg = process.argv[2]; // e.g., "react", "next", "angular"
let selectedFixtures = FIXTURES;
if (frameworkArg) {
  selectedFixtures = FIXTURES.filter(f => f.framework === frameworkArg);
  if (selectedFixtures.length === 0) {
    console.error(`Unknown framework: ${frameworkArg}`);
    process.exit(1);
  }
}

async function copyDirRecursive(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function runCommand(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(cmd, { cwd, maxBuffer: 1024 * 1024 * 10 });
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}\n${error.stderr}`);
  }
}

async function runCliseoScan(cwd: string): Promise<any> {
  const { stdout } = await runCommand('npx cliseo scan --json', cwd);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse CLISEO scan output: ${error}`);
  }
}

async function runCliseoOptimize(framework: Framework, tempDir: string): Promise<void> {
  let optimizeCommand: string;
  switch (framework) {
    case 'react':
      optimizeCommand = `npx cliseo optimize react`;
      break;
    case 'next':
      optimizeCommand = `npx cliseo optimize next`;
      break;
    case 'angular':
      optimizeCommand = `npx cliseo optimize angular`;
      break;
    default:
      throw new Error(`Unsupported framework for optimization: ${framework}`);
  }
  await runCommand(optimizeCommand, tempDir);
}

async function runBuild(framework: Framework, tempDir: string): Promise<{ success: boolean; error?: string }> {
  try {
    let buildCmd: string;
    switch (framework) {
      case 'angular':
        buildCmd = 'npx ng build --configuration=production';
        break;
      case 'next':
        buildCmd = 'npm run build';
        break;
      case 'react':
        buildCmd = 'npm run build';
        break;
      default:
        throw new Error(`Unsupported framework for build: ${framework}`);
    }
    await runCommand(buildCmd, tempDir);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function checkFunctionality(framework: Framework, cwd: string): Promise<{ success: boolean; error?: string }> {
  const port = framework === 'next' ? 3000 : framework === 'angular' ? 4200 : 5173;
  const url = `http://localhost:${port}`;
  
  try {
    // Start dev server with framework-specific command
    let server;
    if (framework === 'angular') {
      server = exec('npx ng serve --host=0.0.0.0 --disable-host-check --poll=2000', { cwd });
    } else {
      server = exec('npm run dev', { cwd });
    }
    
    // Wait for server to start with retries
    const maxRetries = 12;
    const retryDelay = 10000;
    let isServerReady = false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          isServerReady = true;
          break;
        }
      } catch (error) {
        // Server not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    if (!isServerReady) {
      throw new Error('Server failed to start within the maximum retry period');
    }
    
    // Kill server
    server.kill();
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const results: TestResult[] = [];
  const tempDirs: string[] = [];
  const logsDir = path.resolve(__dirname, 'test_run_logs');
  await fs.mkdir(logsDir, { recursive: true });

  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const year = now.getFullYear();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const timestamp = `${month}-${day}-${year} (${hours}:${minutes})`;
  const outputFilename = `${timestamp}.txt`;
  const outputPath = path.join(logsDir, outputFilename);

  try {
    // Copy fixtures to temp directories and run tests in parallel
    await Promise.all(selectedFixtures.map(async ({ framework, fixtureDir }) => {
      const tempDir = path.join(os.tmpdir(), `cliseo-test-${framework}-${randomUUID()}`);
      tempDirs.push(tempDir);
      
      console.log(`[${framework}] Copying fixture to: ${tempDir}`);
      await copyDirRecursive(fixtureDir, tempDir);
      
      // Install dependencies
      console.log(`[${framework}] Installing dependencies...`);
      // Install fixture dependencies AND the local cliseo tool
      const cliseoProjectRoot = path.resolve(__dirname, '..');
      await runCommand(`npm install && npm install file:${cliseoProjectRoot}`, tempDir);
      
      // Run pre-scan
      console.log(`[${framework}] Running pre-scan...`);
      const preScan = await runCliseoScan(tempDir);
      
      // Run optimization
      console.log(`[${framework}] Running optimization...`);
      await runCliseoOptimize(framework, tempDir);
      
      // Run post-scan
      console.log(`[${framework}] Running post-scan...`);
      const postScan = await runCliseoScan(tempDir);
      
      // Run build
      console.log(`[${framework}] Running build...`);
      const buildResult = await runBuild(framework, tempDir);
      
      // Check functionality
      console.log(`[${framework}] Checking functionality...`);
      const functionality = await checkFunctionality(framework, tempDir);
      
      results.push({
        framework,
        fixtureDir,
        tempDir,
        preScan,
        optimization: null,
        postScan,
        build: buildResult,
        functionality,
      });
    }));
    
    // --- Generate Log Output ---
    let logOutput = `CLISEO Test Run: ${timestamp}\n\n`;

    logOutput += "--- Summary ---\n";
  for (const result of results) {
      logOutput += `\nFRAMEWORK: ${result.framework.toUpperCase()}\n`;
      logOutput += `  Build: ${result.build.success ? '✅ Success' : `❌ Failed: ${result.build.error || 'Unknown error'}`}\n`;
      logOutput += `  Functionality: ${result.functionality.success ? '✅ Success' : `❌ Failed: ${result.functionality.error || 'Unknown error'}`}\n`;

      const preScanIssueCount = result.preScan.reduce((sum: number, r: any) => sum + r.issues.length, 0);
      const postScanIssueCount = result.postScan.reduce((sum: number, r: any) => sum + r.issues.length, 0);
      const issuesFixed = preScanIssueCount - postScanIssueCount;

      logOutput += `  SEO Issues Fixed: ${issuesFixed} (Pre-scan: ${preScanIssueCount}, Post-scan: ${postScanIssueCount})\n`;
    }

    logOutput += "\n\n--- Detailed Scan Results ---";
    for (const result of results) {
      logOutput += `\n\n==== FRAMEWORK: ${result.framework.toUpperCase()} ====\n`;
      
      logOutput += `\n  --- Pre-Scan Data ---\n`;
      if (result.preScan && result.preScan.length > 0) {
        for (const scanItem of result.preScan) {
          logOutput += `  File: ${scanItem.file}\n`;
          if (scanItem.issues && scanItem.issues.length > 0) {
            for (const issue of scanItem.issues) {
              logOutput += `    - Type: ${issue.type}\n`;
              logOutput += `      Message: ${issue.message}\n`;
              if (issue.element) {
                logOutput += `      Element: ${issue.element}\n`;
              }
              logOutput += `      Fix: ${issue.fix}\n\n`;
            }
          } else {
            logOutput += `    No issues found in this file.\n\n`;
          }
        }
      } else {
        logOutput += `  No pre-scan data available or no files scanned.\n\n`;
      }

      logOutput += `\n  --- Post-Scan Data ---\n`;
      if (result.postScan && result.postScan.length > 0) {
        for (const scanItem of result.postScan) {
          logOutput += `  File: ${scanItem.file}\n`;
          if (scanItem.issues && scanItem.issues.length > 0) {
            for (const issue of scanItem.issues) {
              logOutput += `    - Type: ${issue.type}\n`;
              logOutput += `      Message: ${issue.message}\n`;
              if (issue.element) {
                logOutput += `      Element: ${issue.element}\n`;
              }
              logOutput += `      Fix: ${issue.fix}\n\n`;
            }
          } else {
            logOutput += `    No issues found in this file.\n\n`;
          }
        }
      } else {
        logOutput += `  No post-scan data available or no issues remaining.\n\n`;
      }
      logOutput += `\n`;
    }
    
    // Write results to text file
    await fs.writeFile(outputPath, logOutput);
    console.log(`Test results written to: ${outputPath}`);
    
    // Print summary
    console.log('\nTest Summary:');
    for (const result of results) {
      console.log(`\n${result.framework.toUpperCase()}:`);
      console.log(`  Build: ${result.build.success ? '✅' : '❌'}`);
      console.log(`  Functionality: ${result.functionality.success ? '✅' : '❌'}`);

      const preScanIssueCount = result.preScan.reduce((sum: number, r: any) => sum + r.issues.length, 0);
      const postScanIssueCount = result.postScan.reduce((sum: number, r: any) => sum + r.issues.length, 0);
      const issuesFixed = preScanIssueCount - postScanIssueCount;

      console.log(`  SEO Issues Fixed: ${issuesFixed} (Pre: ${preScanIssueCount}, Post: ${postScanIssueCount})`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup temp directories
    for (const tempDir of tempDirs) {
      try {
        // Wait a bit before cleanup to ensure processes are terminated
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Use a more robust cleanup by removing contents first
        const entries = await fs.readdir(tempDir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(tempDir, entry.name);
          if (entry.isDirectory()) {
            await fs.rm(entryPath, { recursive: true, force: true });
          } else {
            await fs.unlink(entryPath);
          }
        }
        await fs.rmdir(tempDir);
      } catch (error) {
        console.error(`Failed to cleanup ${tempDir}:`, error);
      }
    }
  }
}

main().catch(console.error);