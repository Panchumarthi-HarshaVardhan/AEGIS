const { _electron: electron } = require('playwright-core');
const path = require('path');

async function run() {
  console.log('Launching Electron application with real local Ollama fallback...');
  const appPath = path.join(__dirname, '..');
  const electronPath = path.join(appPath, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents/MacOS/Electron');
  
  // Set fake GROQ_API_KEY to force fallback to local Ollama
  const cleanEnv = { ...process.env };
  cleanEnv.GROQ_API_KEY = 'your_groq_api_key_here';
  delete cleanEnv.TEST_OFFLINE;

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

  // Test 1: Check System Status to verify AI connection is reported as true (connected to local Ollama)
  console.log('Checking system status...');
  try {
    const status = await window.evaluate(async () => {
      return await window.electronAPI.getSystemStatus();
    });
    console.log('System Status:', status);
    if (status && status.ai_connected === true) {
      console.log('✅ TEST 1 PASSED: AI is reported as connected when Ollama fallback is active.');
    } else {
      console.error('❌ TEST 1 FAILED: Expected ai_connected to be true, got:', status);
    }
  } catch (err) {
    console.error('❌ TEST 1 FAILED with error:', err);
  }

  // Test 2: Send command "open Safari" and verify it maps correctly using the real local Ollama response
  console.log('Sending command "open Safari" to verify intent parsing...');
  try {
    const response = await window.evaluate(async () => {
      return await window.electronAPI.sendCommand('open Safari');
    });
    console.log('Command Response:', response);
    
    if (response && response.intent && response.intent.intent === 'open_app' && response.intent.entities.app_name.toLowerCase().includes('safari')) {
      console.log('✅ TEST 2 PASSED: Recieved expected intent parse and automation trigger.');
    } else {
      console.error('❌ TEST 2 FAILED: Unexpected command response:', response);
    }
  } catch (err) {
    console.error('❌ TEST 2 FAILED with error:', err);
  }

  console.log('Closing app...');
  await electronApp.close();
  console.log('App closed.');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
