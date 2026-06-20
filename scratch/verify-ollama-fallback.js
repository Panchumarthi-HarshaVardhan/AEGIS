const { _electron: electron } = require('playwright-core');
const path = require('path');
const http = require('http');

let mockOllamaServer;

async function startMockOllama() {
  return new Promise((resolve) => {
    mockOllamaServer = http.createServer((req, res) => {
      console.log(`[Mock Ollama] Received request: ${req.method} ${req.url}`);
      
      if (req.url === '/api/tags' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          models: [
            { name: 'llama3:latest' }
          ]
        }));
      } else if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          console.log(`[Mock Ollama] Chat request body: ${body}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            message: {
              role: 'assistant',
              content: JSON.stringify({
                intent: 'open_app',
                entities: { app_name: 'Spotify' },
                risk_level: 0,
                confidence: 0.98,
                natural_response: 'Opening Spotify for you.'
              })
            }
          }));
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    mockOllamaServer.listen(11434, '127.0.0.1', () => {
      console.log('[Mock Ollama] Mock server running on http://127.0.0.1:11434');
      resolve();
    });
  });
}

async function run() {
  await startMockOllama();

  console.log('Launching Electron application with local Ollama fallback...');
  const appPath = path.join(__dirname, '..');
  const electronPath = path.join(appPath, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents/MacOS/Electron');
  
  // Launch Electron with GROQ_API_KEY explicitly set to 'your_groq_api_key_here' (which fails key check, triggering fallback)
  const cleanEnv = { ...process.env };
  cleanEnv.GROQ_API_KEY = 'your_groq_api_key_here';
  // Disable TEST_OFFLINE so it actually pings the port
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

  // Test 2: Send command "open Spotify" and verify it maps correctly using local Ollama response
  console.log('Sending command "open Spotify" to verify intent parsing...');
  try {
    const response = await window.evaluate(async () => {
      return await window.electronAPI.sendCommand('open Spotify');
    });
    console.log('Command Response:', response);
    
    if (response && response.intent && response.intent.intent === 'open_app' && response.intent.entities.app_name === 'Spotify') {
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

  console.log('Stopping mock server...');
  await new Promise((resolve) => mockOllamaServer.close(resolve));
  console.log('Mock server stopped.');
}

run().catch(async (err) => {
  console.error('Test run failed:', err);
  if (mockOllamaServer) {
    await new Promise((resolve) => mockOllamaServer.close(resolve));
  }
  process.exit(1);
});
