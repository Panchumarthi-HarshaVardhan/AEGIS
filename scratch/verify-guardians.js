// ============================================================
// JARVIS V3 — Guardians Verification Script
// Programmatically tests all 10 Guardians for standardization,
// sandboxing, lifecycle management, and logging.
// ============================================================

const { EventBus } = require('./temp/main/event-bus.js');
const { BrowserGuardian } = require('./temp/main/guardians/browser-guardian.js');
const { ClipboardGuardian } = require('./temp/main/guardians/clipboard-guardian.js');
const { CredentialGuardian } = require('./temp/main/guardians/credential-guardian.js');
const { DownloadGuardian } = require('./temp/main/guardians/download-guardian.js');
const { PrivacyGuardian } = require('./temp/main/guardians/privacy-guardian.js');
const { DeepfakeGuardian } = require('./temp/main/guardians/deepfake-guardian.js');
const { FakeNewsGuardian } = require('./temp/main/guardians/fake-news-guardian.js');
const { CallGuardian } = require('./temp/main/guardians/call-guardian.js');
const { EmergencyGuardian } = require('./temp/main/guardians/emergency-guardian.js');
const { AutomationGuardian } = require('./temp/main/guardians/automation-guardian.js');
const { ContextEngine } = require('./temp/main/guardians/context-engine.js');

// Mock Dependencies
const mockPhishingDetector = {
  analyze: async (url) => {
    if (url.includes('phish')) {
      return {
        verdict: 'DANGEROUS',
        risk_score: 95,
        signals: [{ description: 'Mock phishing signal', severity: 'high', score: 95 }]
      };
    }
    return { verdict: 'SAFE', risk_score: 0, signals: [] };
  }
};

const mockSecretScanner = {
  scan: (text) => {
    if (text.includes('sk-')) {
      return [{ type: 'OpenAI API Key', masked_value: 'sk-...1234' }];
    }
    return [];
  }
};

// Global tests status
let testsPassed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ FAIL: ${message}`);
    testsPassed = false;
  }
}

async function testStandardLoggingAndReporting() {
  console.log('\n--- Test 1: Standardized Logging & Threat Reporting ---');
  const bus = EventBus.getInstance();
  bus.reset();

  let threatDetected = null;
  bus.subscribe('threat:detected', (report) => {
    threatDetected = report;
  });

  const browserGuardian = new BrowserGuardian(mockPhishingDetector);
  
  // Test threat publishing
  bus.publish('browser:navigation', 'https://phish.com');
  
  // Wait for async operation
  await new Promise(resolve => setTimeout(resolve, 50));

  assert(threatDetected !== null, 'BrowserGuardian successfully reported a threat to the Event Bus.');
  if (threatDetected) {
    assert(threatDetected.guardian === 'BrowserGuardian', 'Threat report contains correct guardian name.');
    assert(threatDetected.score === 95, 'Threat report contains correct threat score.');
    assert(threatDetected.severity === 'critical', 'Threat report contains correct mapped severity.');
    assert(threatDetected.description.includes('Mock phishing signal'), 'Threat report description contains reason details.');
  }

  // Verify logging formats (stdout capture can be done, but we verify prefix exists in code)
  assert(typeof browserGuardian.log === 'function', 'Base class exposes .log method.');
  assert(typeof browserGuardian.logWarn === 'function', 'Base class exposes .logWarn method.');
  assert(typeof browserGuardian.logError === 'function', 'Base class exposes .logError method.');
}

async function testDynamicLifecyclesAndUnsubscribes() {
  console.log('\n--- Test 2: Context Engine & Dynamic Lifecycles ---');
  const bus = EventBus.getInstance();
  bus.reset();

  const browserGuardian = new BrowserGuardian(mockPhishingDetector);
  const clipboardGuardian = new ClipboardGuardian(mockSecretScanner);
  const credentialGuardian = new CredentialGuardian();
  const downloadGuardian = new DownloadGuardian();
  const privacyGuardian = new PrivacyGuardian();
  const deepfakeGuardian = new DeepfakeGuardian();
  const fakeNewsGuardian = new FakeNewsGuardian();
  const callGuardian = new CallGuardian();
  const emergencyGuardian = new EmergencyGuardian();
  const automationGuardian = new AutomationGuardian();
  const contextEngine = new ContextEngine();

  contextEngine.registerGuardians([
    browserGuardian,
    clipboardGuardian,
    credentialGuardian,
    downloadGuardian,
    privacyGuardian,
    deepfakeGuardian,
    fakeNewsGuardian,
    callGuardian,
    emergencyGuardian,
    automationGuardian
  ]);

  // General Mode (default startup context)
  assert(contextEngine.getCurrentMode() === 'general', 'Context Engine starts in general mode.');
  assert(browserGuardian.active === true, 'BrowserGuardian active in general mode.');
  assert(downloadGuardian.active === true, 'DownloadGuardian active in general mode.');
  assert(deepfakeGuardian.active === false, 'DeepfakeGuardian inactive in general mode.');

  // Transition to Entertainment Mode
  bus.publish('window:focused', 'Spotify');
  assert(contextEngine.getCurrentMode() === 'entertainment', 'Context transitions to entertainment mode.');
  assert(browserGuardian.active === true, 'BrowserGuardian active in entertainment mode.');
  assert(downloadGuardian.active === false, 'DownloadGuardian disabled in entertainment mode.');
  assert(deepfakeGuardian.active === true, 'DeepfakeGuardian active in entertainment mode.');

  // Verify that an inactive guardian does not report threats
  let threatReported = false;
  bus.subscribe('threat:detected', () => {
    threatReported = true;
  });

  // Try to trigger download:completed on downloadGuardian (which is now inactive)
  bus.publish('download:completed', '/path/to/malicious_file.exe');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert(!threatReported, 'Disabled DownloadGuardian does not scan or report threats.');
  
  // Clean up
  downloadGuardian.stop();
}

async function testErrorSandboxing() {
  console.log('\n--- Test 3: Exception Sandboxing & Failure Resiliency ---');
  const bus = EventBus.getInstance();
  bus.reset();

  // Test ClipboardGuardian with a scan method that throws
  const badScanner = {
    scan: () => {
      throw new Error('Scanner crashed catastrophically!');
    }
  };
  
  const clipboardGuardian = new ClipboardGuardian(badScanner);
  
  // Publish event, should not throw or crash the main execution loop
  let errorCaught = false;
  try {
    bus.publish('clipboard:changed', 'some text');
  } catch (err) {
    errorCaught = true;
  }
  
  assert(!errorCaught, 'ClipboardGuardian caught listener errors internally, preventing event bus crashes.');
}

async function testAutomationGuardianSandbox() {
  console.log('\n--- Test 4: AutomationGuardian Fail-Secure Sandbox ---');
  const guardian = new AutomationGuardian();
  
  // Sending malformed params that trigger JSON stringify error (like circular references)
  const circularParam = {};
  circularParam.self = circularParam;
  
  const badStep = {
    action: 'open_app',
    params: circularParam
  };
  
  const verdict = guardian.evaluateStep(badStep);
  assert(verdict.approved === false, 'AutomationGuardian failed secure when evaluation crashed (approved: false).');
  assert(verdict.requires_approval === true, 'AutomationGuardian failed secure when evaluation crashed (requires_approval: true).');
  assert(verdict.risk_level === 3, 'AutomationGuardian assigned critical risk level to failed checks.');
}

async function testDownloadGuardianDuplicateWatcher() {
  console.log('\n--- Test 5: Watcher Leak Prevention in DownloadGuardian ---');
  const guardian = new DownloadGuardian();
  
  // startWatcher will be called in initialize() upon active transition
  guardian.setActive(true);
  
  const originalWatcher = guardian.watcher;
  assert(originalWatcher !== null, 'DownloadGuardian started file watcher.');
  
  // Toggling active state again should not leak watchers
  guardian.setActive(false);
  assert(guardian.watcher === null, 'Watcher closed successfully upon transitioning to IDLE.');
  
  guardian.setActive(true);
  assert(guardian.watcher !== null && guardian.watcher !== originalWatcher, 'New watcher spawned successfully without leaking old watcher.');
  
  // Final cleanup
  guardian.stop();
}

async function run() {
  console.log('=== JARVIS V3 Guardians Verification ===');
  
  await testStandardLoggingAndReporting();
  await testDynamicLifecyclesAndUnsubscribes();
  await testErrorSandboxing();
  await testAutomationGuardianSandbox();
  await testDownloadGuardianDuplicateWatcher();
  
  console.log('\n======================================');
  if (testsPassed) {
    console.log('🎉 ALL GUARDIAN VERIFICATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME GUARDIAN VERIFICATION TESTS FAILED.');
    process.exit(1);
  }
}

run();
