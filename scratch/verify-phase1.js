// ============================================================
// AEGIS Production Architecture — Phase 1 Verification Script
// Tests WebSocket Bridge Handshake Origin Security
// ============================================================

const { WSBridge } = require('../src/main/ws-bridge')
const WebSocket = require('ws')

// Mock engines for WSBridge constructor
const mockSecurityEngine = {}
const mockIntentEngine = {}

async function run() {
  console.log('=== AEGIS Phase 1 Handshake Security Verification ===\n')

  const testPort = 9999
  const bridge = new WSBridge(testPort, mockSecurityEngine, mockIntentEngine)
  
  console.log('Starting test WSBridge on port 9999...')
  bridge.start()

  let passed = true

  // Test 1: Empty Origin (local tools, CLI client, etc.)
  try {
    console.log('[Test 1] Connecting with empty Origin (allowed)...')
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}`)
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('  ✓ Connected successfully.');
        ws.close()
        resolve()
      })
      ws.on('error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`))
      })
    })
  } catch (err) {
    console.error('  ✕ Test 1 Failed:', err.message)
    passed = false
  }

  // Test 2: chrome-extension:// Origin (extension client)
  try {
    console.log('[Test 2] Connecting with chrome-extension:// origin (allowed)...')
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}`, {
      headers: { origin: 'chrome-extension://aegis-security-companion-id' }
    })
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('  ✓ Connected successfully.');
        ws.close()
        resolve()
      })
      ws.on('error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`))
      })
    })
  } catch (err) {
    console.error('  ✕ Test 2 Failed:', err.message)
    passed = false
  }

  // Test 3: http://evil.com Origin (forbidden browser page)
  try {
    console.log('[Test 3] Connecting with http://evil.com origin (should be blocked)...')
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}`, {
      headers: { origin: 'http://evil.com' }
    })
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.close()
        reject(new Error('Connection succeeded but should have been blocked'))
      })
      ws.on('unexpected-response', (req, res) => {
        // ws library triggers unexpected-response on failed upgrade handshakes
        console.log(`  ✓ Blocked upgrade with status: ${res.statusCode} ${res.statusMessage}`)
        resolve()
      })
      ws.on('close', (code) => {
        // Closed by server during handshake
        console.log(`  ✓ Blocked by server, connection closed with code: ${code}`)
        resolve()
      })
      ws.on('error', (err) => {
        // Connection error is expected when rejected during handshake
        console.log('  ✓ Connection rejected:', err.message)
        resolve()
      })
    })
  } catch (err) {
    console.error('  ✕ Test 3 Failed:', err.message)
    passed = false
  }

  console.log('\nStopping test WSBridge...')
  bridge.stop()

  // Test 4: FastAPI Graceful Shutdown Test
  console.log('\n[Test 4] Testing FastAPI Graceful Shutdown...')
  const { spawn } = require('child_process')
  const fs = require('fs')
  const path = require('path')

  let pythonBin = 'python3'
  const venvPath = path.join(__dirname, '..', 'backend', 'venv', 'bin', 'python')
  const venvWinPath = path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe')
  
  if (fs.existsSync(venvPath)) {
    pythonBin = venvPath
  } else if (fs.existsSync(venvWinPath)) {
    pythonBin = venvWinPath
  }

  const pythonTestPort = 8001
  console.log(`  Spawning Python backend on test port ${pythonTestPort}...`)
  
  const pythonScript = path.join(__dirname, '..', 'backend', 'main.py')
  const pythonProcess = spawn(pythonBin, [pythonScript], {
    env: { ...process.env, PORT: String(pythonTestPort) },
    cwd: path.join(__dirname, '..', 'backend')
  })

  let pythonExitCode = null
  let exitedFlag = false
  pythonProcess.on('exit', (code) => {
    pythonExitCode = code
    exitedFlag = true
    console.log(`  ✓ Python backend process exited with code: ${code}`)
  })

  // Wait for the backend to start up by polling /health
  let serverReady = false
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    try {
      const res = await fetch(`http://127.0.0.1:${pythonTestPort}/health`)
      if (res.ok) {
        serverReady = true
        console.log('  Backend is online and healthy.')
        break
      }
    } catch (e) {
      // Not ready yet
    }
  }

  if (!serverReady) {
    console.error('  ✕ Failed to start Python backend on port 8001.')
    pythonProcess.kill()
    passed = false
  } else {
    // Send shutdown request
    try {
      console.log('  Sending POST /api/shutdown...')
      const res = await fetch(`http://127.0.0.1:${pythonTestPort}/api/shutdown`, {
        method: 'POST'
      })
      const data = await res.json()
      console.log(`  Shutdown response: ${JSON.stringify(data)}`)
    } catch (err) {
      console.warn('  Failed to send shutdown request:', err.message)
      passed = false
    }

    // Wait up to 3 seconds for the process to exit
    let exited = false
    for (let i = 0; i < 12; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      if (exitedFlag || pythonProcess.killed) {
        exited = true
        break
      }
    }

    if (!exited) {
      console.error('  ✕ Python process did not terminate after shutdown request.')
      pythonProcess.kill()
      passed = false
    } else {
      console.log('  ✓ Python backend terminated gracefully.')
    }
  }

  if (passed) {
    console.log('\n🎉 ALL PHASE 1 SECURITY & LIFECYCLE TESTS PASSED SUCCESSFULLY!')
    process.exit(0)
  } else {
    console.log('\n❌ SOME PHASE 1 TESTS FAILED.')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Verification crashed:', err)
  process.exit(1)
})
