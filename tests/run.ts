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
    
    if (entry.name === 'node_modules') { // Skip node_modules
      continue;
    }
    
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
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
    throw new Error(`Failed to parse cliseo scan output: ${error}`);
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
  
  let serverProcess: import('child_process').ChildProcess | undefined;
  let serverEarlyExitError: string | undefined;

  try {
    if (framework === 'next') {
      try {
        const nextConfigPath = path.join(cwd, 'next.config.js');
        const nextConfigContent = await fs.readFile(nextConfigPath, 'utf-8');
        console.log(`[${framework} Debug] Content of next.config.js:\n${nextConfigContent}`);
      } catch (e: any) {
        console.error(`[${framework} Debug] Error reading next.config.js: ${e.message}`);
      }
    }
    // Start dev server with framework-specific command
    const commandOptions = { cwd, detached: true }; // detached: true to allow killing process group

    if (framework === 'angular') {
      const ngPath = path.join(cwd, 'node_modules', '.bin', 'ng');
      serverProcess = exec(`${ngPath} serve --host=0.0.0.0 --poll=2000 --port=${port} --watch=false --verbose`, {
        ...commandOptions,
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
      });
    } else if (framework === 'next') {
      serverProcess = exec(`npm run dev -- --port ${port}`, commandOptions);
    } else { // react
      serverProcess = exec(`npm run dev -- --port ${port}`, commandOptions);
    }
    
    if (!serverProcess || serverProcess.pid === undefined) {
      return { success: false, error: 'Failed to create server process or PID undefined.' };
    }

    console.log(`[${framework}] Started server process with PID: ${serverProcess.pid}`);

    // Listen for early exit or errors from the server process
    serverProcess.on('error', (err) => {
      console.error(`[${framework} Server Process Error] ${err.message}`);
      serverEarlyExitError = `Server process emitted error: ${err.message}`;
      // Attempt to kill just in case, though 'error' often means it didn't launch
      if (serverProcess && !serverProcess.killed) serverProcess.kill();
    });

    serverProcess.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGKILL' && signal !== 'SIGTERM' && signal !== 'SIGINT') { // Don't log expected kills
        console.warn(`[${framework} Server Process Exited] Code: ${code}, Signal: ${signal}`);
        serverEarlyExitError = `Server process exited prematurely with code ${code}, signal ${signal}. Check STDOUT/STDERR logs.`;
      }
    });

    // Log server output for debugging
    serverProcess.stdout?.on('data', (data) => console.log(`[${framework} Server STDOUT] ${data.toString().trim()}`));
    serverProcess.stderr?.on('data', (data) => console.error(`[${framework} Server STDERR] ${data.toString().trim()}`));
    
    // Wait for server to start with retries
    const maxRetries = 6; // Increased
    const retryDelay = 20000; // Increased
    const initialDelay = framework === 'angular' ? 30000 : 10000; // Longer initial delay for Angular
    let isServerReady = false;
    let lastError: string | undefined;

    console.log(`[${framework}] Waiting ${initialDelay/1000}s initial delay for server to spin up...`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    for (let i = 0; i < maxRetries; i++) {
      if (serverEarlyExitError) { // Check if server exited or errored out before proceeding
        return { success: false, error: `Server process failed before readiness check: ${serverEarlyExitError}` };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased fetch timeout

      try {
        console.log(`[${framework}] Attempt ${i + 1}/${maxRetries} to connect to server at ${url}...`);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const responseText = await response.text();
          console.log(`[${framework}] Server responded OK. Status: ${response.status}. Response length: ${responseText.length}`);
          isServerReady = true;
          console.log(`[${framework}] Server is ready!`);
          break;
        } else {
          const responseBody = await response.text().catch(() => "[[Could not read response body]]");
          lastError = `Server responded with status ${response.status} (${response.statusText}). Preview: ${responseBody.substring(0, 200)}`;
          console.log(`[${framework}] Server not ready yet (${lastError}), retrying in ${retryDelay/1000}s...`);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        // Log the full error object for more details
        lastError = error instanceof Error ? `Name: ${error.name}, Message: ${error.message}, Stack: ${error.stack}` : String(error);
        if (error.name === 'AbortError') {
          lastError = 'Request timed out after 15 seconds.'; // Updated timeout message
        }
        console.log(`[${framework}] Server not ready yet (Full error: ${lastError}), retrying in ${retryDelay/1000}s...`);
      }
      if (i < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    if (!isServerReady) {
      const finalError = serverEarlyExitError ? `Server process failed: ${serverEarlyExitError}` : `Server failed to start or respond at ${url} within the maximum retry period. Last error: ${lastError}`;
      return { success: false, error: finalError };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    // Kill server process if it was started
    if (serverProcess && serverProcess.pid && !serverProcess.killed) {
      const pid = serverProcess.pid;
      console.log(`[${framework}] Attempting to kill server process tree (PID: ${pid})...`);
      try {
        // Using negative PID to kill the process group, requires detached: true
        // This is more effective for processes that spawn children (like npm scripts)
        process.kill(-pid, 'SIGTERM'); 
        console.log(`[${framework}] Sent SIGTERM to process group ${pid}.`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for graceful shutdown

        if (!serverProcess.killed) {
          console.warn(`[${framework}] Process group ${pid} did not terminate with SIGTERM, trying SIGKILL.`);
          process.kill(-pid, 'SIGKILL');
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for SIGKILL to take effect
          if (!serverProcess.killed) {
             console.error(`[${framework}] Failed to kill process group ${pid} with SIGKILL.`);
          } else {
            console.log(`[${framework}] Process group ${pid} killed with SIGKILL.`);
          }
        } else {
          console.log(`[${framework}] Process group ${pid} terminated successfully.`);
        }
      } catch (killError: any) {
        // Fallback for individual process kill if group kill fails or PID is not group leader
        console.warn(`[${framework}] Failed to kill process group ${pid} (may not be group leader or process already exited): ${killError.message}. Attempting individual kill.`);
        try {
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (!serverProcess.killed) {
                serverProcess.kill('SIGKILL');
                await new Promise(resolve => setTimeout(resolve, 1000));
                 if (!serverProcess.killed) {
                    console.error(`[${framework}] Failed to kill server process PID ${pid} with SIGKILL.`);
                 } else {
                    console.log(`[${framework}] Server process PID ${pid} killed with SIGKILL.`);
                 }
            } else {
                 console.log(`[${framework}] Server process PID ${pid} killed successfully with SIGTERM.`);
            }
        } catch (finalKillError: any) {
            console.error(`[${framework}] Error during final attempt to kill server process PID ${pid}: ${finalKillError.message}`);
        }
      }
    }
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
      
      console.log(`[${framework}] Copying fixture source files to: ${tempDir}`);
      await copyDirRecursive(fixtureDir, tempDir);

      // Install dependencies
      console.log(`[${framework}] Installing dependencies in ${tempDir}...`);
      // Install fixture dependencies AND the local cliseo tool
      const cliseoProjectRoot = path.resolve(__dirname, '..');
      await runCommand(`npm install && npm install file:${cliseoProjectRoot}`, tempDir);

      // Verify critical files for Angular after copying the entire fixture
      if (framework === 'angular') {
        const criticalFiles = [
          'tsconfig.json',
          'tsconfig.app.json',
          'angular.json',
          'src/main.ts',
          'src/styles.css',
          'src/index.html'
        ];
        
        for (const file of criticalFiles) {
          const filePath = path.join(tempDir, file);
          try {
            await fs.access(filePath);
          } catch (error) {
            // Ensure a more specific error is thrown here
            throw new Error(`Critical file missing after copy for ${framework} in ${tempDir}: ${file}. Error: ${error}`);
          }
        }
      }
      
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
    let logOutput = `cliseo Test Run: ${timestamp}\n\n`;

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