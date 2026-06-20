import { isValidFilePath } from '../src/main/security/path-validator'
import { RiskClassifier } from '../src/main/security/risk-classifier'
import { AutomationGuardian } from '../src/main/guardians/automation-guardian'
import { ActionEngine } from '../src/main/engines/action-engine'
import { MacOSAutomation } from '../src/main/automation/macos-automation'
import { PlaywrightAutomation } from '../src/main/automation/playwright-automation'
import type { ActionStep } from '../src/main/engines/planner-engine'
import type { ParsedIntent } from '../src/shared/types'

// Mock MacOSAutomation to record calls
class MockMacOSAutomation extends MacOSAutomation {
  public lastOpenedUrl: string | null = null;
  public lastOpenedApp: string | null = null;

  async openUrl(url: string): Promise<void> {
    this.lastOpenedUrl = url;
  }

  async openApp(appName: string): Promise<void> {
    this.lastOpenedApp = appName;
  }
}

class MockPlaywrightAutomation extends PlaywrightAutomation {
  async playMusic(query: string, platform: 'spotify' | 'youtube'): Promise<void> {
    // no-op for tests
  }
}

async function runTests() {
  console.log('--- RUNNING AEGIS AUTOMATION SECURITY TESTS ---\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failedTests++;
    }
  }

  // --- Test Group 1: Path Validator ---
  console.log('\n[Group 1: Path Validator]');
  assert(isValidFilePath('Documents/project/file.txt') === true, 'Allows standard relative user file path');
  assert(isValidFilePath('/Users/pharshavardhan/Documents/file.txt') === true, 'Allows standard absolute user file path');
  assert(isValidFilePath('Documents/../../etc/passwd') === false, 'Blocks directory traversal (../)');
  assert(isValidFilePath('Documents/.ssh/id_rsa') === false, 'Blocks access to hidden folders (.ssh)');
  assert(isValidFilePath('Documents/.env') === false, 'Blocks access to hidden files (.env)');
  assert(isValidFilePath('/etc/passwd') === false, 'Blocks access to restricted system folder (/etc)');
  assert(isValidFilePath('/private/var/log') === false, 'Blocks access to restricted system folder (/private)');

  // --- Test Group 2: Risk Classifier ---
  console.log('\n[Group 2: Risk Classifier]');
  const classifier = new RiskClassifier();
  
  const safeOpenIntent: ParsedIntent = {
    intent: 'open_app',
    entities: { app_name: 'Safari' },
    risk_level: 0,
    confidence: 1.0,
    natural_response: 'Opening Safari'
  };
  const safeOpenRisk = classifier.classify(safeOpenIntent);
  assert(safeOpenRisk.level === 0 && safeOpenRisk.requires_approval === false, 'Classifies safe app open as Risk Level 0 (no approval)');

  const riskyOpenIntent: ParsedIntent = {
    intent: 'open_app',
    entities: { app_name: 'Terminal' },
    risk_level: 1,
    confidence: 1.0,
    natural_response: 'Opening Terminal'
  };
  const riskyOpenRisk = classifier.classify(riskyOpenIntent);
  assert(riskyOpenRisk.level === 1 && riskyOpenRisk.requires_approval === true, 'Classifies Terminal open as Risk Level 1 (requires approval)');

  const safeFileOpenIntent: ParsedIntent = {
    intent: 'file_operation',
    entities: { action: 'open', file_path: '/Users/pharshavardhan/Documents/invoice.pdf' },
    risk_level: 0,
    confidence: 1.0,
    natural_response: 'Opening invoice.pdf'
  };
  const safeFileOpenRisk = classifier.classify(safeFileOpenIntent);
  assert(safeFileOpenRisk.level === 0 && safeFileOpenRisk.requires_approval === false, 'Classifies safe file open as Risk Level 0 (no approval)');

  const scriptOpenIntent: ParsedIntent = {
    intent: 'file_operation',
    entities: { action: 'open', file_path: '/Users/pharshavardhan/Downloads/setup.sh' },
    risk_level: 2,
    confidence: 1.0,
    natural_response: 'Opening setup.sh'
  };
  const scriptOpenRisk = classifier.classify(scriptOpenIntent);
  assert(scriptOpenRisk.level === 2 && scriptOpenRisk.requires_approval === true, 'Classifies opening shell script as Risk Level 2 (requires approval)');

  const shutdownIntent: ParsedIntent = {
    intent: 'system_control',
    entities: { action: 'shutdown' },
    risk_level: 1,
    confidence: 1.0,
    natural_response: 'Shutting down'
  };
  const shutdownRisk = classifier.classify(shutdownIntent);
  assert(shutdownRisk.level === 1 && shutdownRisk.requires_approval === true, 'Classifies system shutdown as Risk Level 1 (requires approval)');

  // --- Test Group 3: Automation Guardian ---
  console.log('\n[Group 3: Automation Guardian]');
  const guardian = new AutomationGuardian();
  guardian.setActive(true);

  const safeAppStep: ActionStep = {
    action: 'open_app',
    params: { app_name: 'Safari' },
    risk_level: 0,
    description: 'Open Safari'
  };
  const safeAppVerdict = guardian.evaluateStep(safeAppStep);
  assert(safeAppVerdict.requires_approval === false && safeAppVerdict.risk_level === 0, 'Allows safe app open without approval');

  const riskyAppStep: ActionStep = {
    action: 'open_app',
    params: { app_name: 'Terminal' },
    risk_level: 1,
    description: 'Open Terminal'
  };
  const riskyAppVerdict = guardian.evaluateStep(riskyAppStep);
  assert(riskyAppVerdict.requires_approval === true && riskyAppVerdict.risk_level === 1, 'Requires approval for Terminal open');

  const shutdownStep: ActionStep = {
    action: 'system_power',
    params: { action: 'shutdown' },
    risk_level: 2,
    description: 'Shut down system'
  };
  const shutdownVerdict = guardian.evaluateStep(shutdownStep);
  assert(shutdownVerdict.requires_approval === true && shutdownVerdict.risk_level === 2, 'Requires approval for system power actions (shutdown)');

  const scriptOpenStep: ActionStep = {
    action: 'file_open',
    params: { file_path: 'install.sh' },
    risk_level: 2,
    description: 'Open install.sh'
  };
  const scriptOpenVerdict = guardian.evaluateStep(scriptOpenStep);
  assert(scriptOpenVerdict.requires_approval === true && scriptOpenVerdict.risk_level === 2, 'Requires approval for opening scripts/executables (.sh)');

  const deleteStep: ActionStep = {
    action: 'file_delete',
    params: { file_path: 'temp.txt' },
    risk_level: 2,
    description: 'Delete temp.txt'
  };
  const deleteVerdict = guardian.evaluateStep(deleteStep);
  assert(deleteVerdict.requires_approval === true && deleteVerdict.risk_level === 2, 'Requires approval for file deletions');

  // --- Test Group 4: Action Engine file_open & Validation ---
  console.log('\n[Group 4: Action Engine File Open & Security]');
  const mockMacos = new MockMacOSAutomation();
  const mockPlaywright = new MockPlaywrightAutomation();
  const actionEngine = new ActionEngine(mockMacos, mockPlaywright);

  const safeFileStep: ActionStep = {
    action: 'file_open',
    params: { file_path: '/Users/pharshavardhan/Documents/report.txt' },
    risk_level: 0,
    description: 'Open report.txt'
  };
  const safeFileResult = await actionEngine.execute(safeFileStep);
  assert(safeFileResult.success === true && mockMacos.lastOpenedUrl === '/Users/pharshavardhan/Documents/report.txt', 'Successfully executes file_open on safe paths');

  const unsafeFileStep: ActionStep = {
    action: 'file_open',
    params: { file_path: '/etc/passwd' },
    risk_level: 0,
    description: 'Open /etc/passwd'
  };
  const unsafeFileResult = await actionEngine.execute(unsafeFileStep);
  assert(unsafeFileResult.success === false && unsafeFileResult.error === 'Access denied', 'Blocks execution of file_open on unsafe paths (/etc/passwd)');

  // --- Test Summary ---
  console.log(`\n--- TEST SUMMARY ---`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
