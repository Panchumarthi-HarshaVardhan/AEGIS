const { _electron: electron } = require('playwright-core');
const path = require('path');

async function run() {
  console.log('Launching Electron application...');
  const appPath = path.join(__dirname, '..');
  const electronPath = path.join(appPath, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents/MacOS/Electron');
  
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [path.join(appPath, 'out/main/index.js')]
  });

  const proc = electronApp.process();
  proc.stdout.on('data', (data) => {
    console.log(`[Electron STDOUT] ${data.toString().trim()}`);
  });
  proc.stderr.on('data', (data) => {
    console.error(`[Electron STDERR] ${data.toString().trim()}`);
  });

  console.log('App launched successfully! Waiting for window...');
  
  const window = await electronApp.firstWindow();
  console.log('Main window retrieved.');
  
  // Wait for the window to load
  await window.waitForLoadState('domcontentloaded');
  console.log('DOM Content Loaded.');

  // Test 1: File path validation on document summarization
  console.log('Testing document summarization with /etc/passwd...');
  try {
    const res = await window.evaluate(async () => {
      return await window.electronAPI.summarizeDocument('/etc/passwd');
    });
    console.log('Result for /etc/passwd:', res);
    if (res && res.success === false && res.error.includes('Access denied')) {
      console.log('✅ TEST 1 PASSED: Access to /etc/passwd was denied.');
    } else {
      console.error('❌ TEST 1 FAILED: Unexpected result:', res);
    }
  } catch (err) {
    console.error('❌ TEST 1 FAILED with error:', err);
  }

  // Test 2: File path validation on deepfake check
  console.log('Testing deepfake check with .ssh/id_rsa...');
  try {
    const res = await window.evaluate(async () => {
      return await window.electronAPI.checkDeepfake('/Users/pharshavardhan/.ssh/id_rsa');
    });
    console.log('Result for .ssh/id_rsa:', res);
    if (res && res.success === false && res.error.includes('Access denied')) {
      console.log('✅ TEST 2 PASSED: Access to .ssh/id_rsa was denied.');
    } else {
      console.error('❌ TEST 2 FAILED: Unexpected result:', res);
    }
  } catch (err) {
    console.error('❌ TEST 2 FAILED with error:', err);
  }

  // Test 3: Sandbox validation
  console.log('Testing sandbox value...');
  try {
    const isSandboxed = await window.evaluate(async () => {
      return typeof process === 'undefined' || !process.versions || !process.versions.node;
    });
    console.log('Is renderer sandboxed?', isSandboxed);
    if (isSandboxed) {
      console.log('✅ TEST 3 PASSED: Renderer is sandboxed.');
    } else {
      console.error('❌ TEST 3 FAILED: Renderer is not sandboxed.');
    }
  } catch (err) {
    console.error('❌ TEST 3 FAILED with error:', err);
  }

  // Test 4: Navigation blocking
  console.log('Testing navigation to external URL (https://example.com)...');
  try {
    const originalUrl = window.url();
    console.log('Original URL:', originalUrl);
    
    await window.evaluate(() => {
      window.location.href = 'https://example.com';
    });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newUrl = window.url();
    console.log('New URL:', newUrl);
    if (newUrl === originalUrl || !newUrl.includes('example.com')) {
      console.log('✅ TEST 4 PASSED: Navigation to external URL was blocked.');
    } else {
      console.error('❌ TEST 4 FAILED: Window navigated to:', newUrl);
    }
  } catch (err) {
    console.error('❌ TEST 4 FAILED with error:', err);
  }

  console.log('Closing app...');
  await electronApp.close();
  console.log('App closed.');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
