const { _electron: electron } = require('playwright-core');
const path = require('path');

async function run() {
  console.log('Launching Electron application with a cleared GROQ_API_KEY...');
  const appPath = path.join(__dirname, '..');
  const electronPath = path.join(appPath, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents/MacOS/Electron');
  
  // Launch Electron with TEST_OFFLINE enabled to force offline state
  const cleanEnv = { ...process.env, TEST_OFFLINE: 'true' };

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [path.join(appPath, 'out/main/index.js')],
    env: cleanEnv
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

  // Test 1: Check System Status to verify AI connection is reported as false/disconnected
  console.log('Checking system status...');
  try {
    const status = await window.evaluate(async () => {
      return await window.electronAPI.getSystemStatus();
    });
    console.log('System Status:', status);
    if (status && status.ai_connected === false) {
      console.log('✅ TEST 1 PASSED: AI is correctly reported as disconnected when no provider is available.');
    } else {
      console.error('❌ TEST 1 FAILED: Expected ai_connected to be false, got:', status);
    }
  } catch (err) {
    console.error('❌ TEST 1 FAILED with error:', err);
  }

  // Test 2: Send a command and verify the fallback/friendly message is returned
  console.log('Sending command "hello" to check fallback message...');
  try {
    const response = await window.evaluate(async () => {
      return await window.electronAPI.sendCommand('hello');
    });
    console.log('Command Response:', response);
    
    if (response && response.message && response.message.includes('No AI provider is configured')) {
      console.log('✅ TEST 2 PASSED: Recieved expected friendly fallback warning.');
    } else {
      console.error('❌ TEST 2 FAILED: Expected fallback warning, got:', response);
    }
  } catch (err) {
    console.error('❌ TEST 2 FAILED with error:', err);
  }

  // Test 3: Verify that system is still fully functional (e.g. history and preferences can be retrieved)
  console.log('Verifying preference retrieve...');
  try {
    const pref = await window.evaluate(async () => {
      return await window.electronAPI.getPreference('onboarding_completed');
    });
    console.log('Preference onboarding_completed:', pref);
    console.log('✅ TEST 3 PASSED: Preference system is active.');
  } catch (err) {
    console.error('❌ TEST 3 FAILED with error:', err);
  }

  console.log('Closing app...');
  await electronApp.close();
  console.log('App closed.');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
