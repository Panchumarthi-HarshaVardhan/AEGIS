// ============================================================
// JARVIS V4 — Simulation Engine
// Pre-execution validation, dry-run, and safety simulation
// ============================================================

import type { ActionPlan, ActionStep } from './planner-engine';
import { PermissionManager } from '../services/permission-manager';
import type { PermissionType, PermissionState } from '../../shared/types';

export interface SimulationResult {
  safe: boolean;
  warnings: string[];
  blockers: string[];
  estimatedDuration: number;
  reversible: boolean;
}

export class SimulationEngine {
  private static instance: SimulationEngine | null = null;

  private constructor() {}

  public static getInstance(): SimulationEngine {
    if (!SimulationEngine.instance) {
      SimulationEngine.instance = new SimulationEngine();
    }
    return SimulationEngine.instance;
  }

  /**
   * Dry-runs an action plan to detect missing parameters, platform incompatibility,
   * permission blocks, and reversibility issues.
   */
  public simulate(plan: ActionPlan): SimulationResult {
    const result: SimulationResult = {
      safe: true,
      warnings: [],
      blockers: [],
      estimatedDuration: 0,
      reversible: true,
    };

    if (!plan.steps || plan.steps.length === 0) {
      result.blockers.push('Action plan contains no executable steps.');
      result.safe = false;
      return result;
    }

    const platform = process.platform;
    const supportedPlatforms = ['darwin', 'win32', 'linux'];

    if (!supportedPlatforms.includes(platform)) {
      result.blockers.push(`OS Platform "${platform}" is not supported by AEGIS automation.`);
      result.safe = false;
    }

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepNum = i + 1;

      // 1. Validate required parameters per action type
      this.validateParameters(step, stepNum, result);

      // 2. Check permission state
      this.checkPermissions(step, stepNum, result);

      // 3. Estimate duration and determine reversibility
      const duration = this.estimateStepDuration(step.action);
      result.estimatedDuration += duration;

      if (!this.isStepReversible(step.action)) {
        result.reversible = false;
        result.warnings.push(
          `Step ${stepNum} (${step.action}) is irreversible. State changes cannot be rolled back automatically.`
        );
      }
    }

    if (result.blockers.length > 0) {
      result.safe = false;
    }

    return result;
  }

  private validateParameters(step: ActionStep, stepNum: number, result: SimulationResult): void {
    const params = step.params || {};

    switch (step.action) {
      case 'open_app':
        if (!params.app_name && !params.name) {
          result.blockers.push(`Step ${stepNum} (open_app) is missing required parameter "app_name" or "name".`);
        }
        break;

      case 'open_url':
        if (!params.url) {
          result.blockers.push(`Step ${stepNum} (open_url) is missing required parameter "url".`);
        }
        break;

      case 'play_music':
        if (!params.song && !params.query) {
          result.blockers.push(`Step ${stepNum} (play_music) is missing required parameter "song" or "query".`);
        }
        break;

      case 'search_web':
      case 'search_product':
        if (!params.query) {
          result.blockers.push(`Step ${stepNum} (${step.action}) is missing required parameter "query".`);
        }
        break;

      case 'set_volume':
      case 'set_brightness':
        if (params.level === undefined && params.value === undefined) {
          result.blockers.push(`Step ${stepNum} (${step.action}) is missing required numeric parameter "level" or "value".`);
        }
        break;

      case 'search_files':
        if (!params.query) {
          result.blockers.push(`Step ${stepNum} (search_files) is missing required parameter "query".`);
        }
        break;

      case 'show_notification':
        if (!params.message) {
          result.blockers.push(`Step ${stepNum} (show_notification) is missing required parameter "message".`);
        }
        break;

      case 'set_appearance':
        if (!params.theme && !params.action) {
          result.blockers.push(`Step ${stepNum} (set_appearance) is missing required parameter "theme" or "action".`);
        }
        break;

      case 'system_power':
        if (!params.action) {
          result.blockers.push(`Step ${stepNum} (system_power) is missing required parameter "action" (e.g. sleep, restart).`);
        }
        break;

      case 'summarize':
        if (!params.query && !params.url) {
          result.blockers.push(`Step ${stepNum} (summarize) requires at least "query" or "url" parameters.`);
        }
        break;

      case 'file_open':
      case 'file_delete':
        if (!params.file_path && !params.query) {
          result.blockers.push(`Step ${stepNum} (${step.action}) is missing required parameter "file_path".`);
        }
        break;

      case 'file_copy':
        if ((!params.file_path && !params.source) || (!params.destination && !params.dest)) {
          result.blockers.push(`Step ${stepNum} (file_copy) requires both source and destination path parameters.`);
        }
        break;

      case 'file_download':
        if (!params.url && !params.file_path) {
          result.blockers.push(`Step ${stepNum} (file_download) requires a "url" parameter.`);
        }
        break;

      case 'scan_for_malware':
      case 'file_scan_for_malware':
      case 'file_scan':
        if (!params.file_path && !params.query && !params.value) {
          result.blockers.push(`Step ${stepNum} (${step.action}) is missing required parameter "file_path".`);
        }
        break;

      default:
        // no validation needed or unknown action which will fail verification
        break;
    }
  }

  private checkPermissions(step: ActionStep, stepNum: number, result: SimulationResult): void {
    const permission = this.mapActionToPermission(step.action);
    if (!permission) return;

    const pm = PermissionManager.getInstance();
    const state = pm.check(permission);

    if (state === 'denied') {
      result.blockers.push(
        `Step ${stepNum} (${step.action}) requires "${permission}" permission, which is explicitly DENIED.`
      );
    } else if (state === 'ask_every_time' || state === 'not_set') {
      result.warnings.push(
        `Step ${stepNum} (${step.action}) requires "${permission}" permission, which will prompt the user during execution.`
      );
    }
  }

  private mapActionToPermission(action: string): PermissionType | null {
    switch (action) {
      case 'open_app':
      case 'open_url':
      case 'play_music':
      case 'search_web':
      case 'search_product':
        return 'automation';

      case 'set_volume':
      case 'set_brightness':
      case 'set_appearance':
      case 'system_power':
        return 'accessibility';

      case 'search_files':
      case 'file_open':
      case 'file_delete':
      case 'file_copy':
      case 'scan_for_malware':
      case 'file_scan_for_malware':
      case 'file_scan':
        return 'file_system';

      case 'file_download':
        return 'downloads';

      case 'ocr_screen':
      case 'audit_screen_links':
        return 'screen_recording';

      case 'show_notification':
        return 'notifications';

      default:
        return null;
    }
  }

  private estimateStepDuration(action: string): number {
    switch (action) {
      case 'noop':
        return 0;
      case 'file_delete':
      case 'file_copy':
      case 'set_volume':
      case 'set_brightness':
      case 'set_appearance':
      case 'show_notification':
        return 500; // 0.5s
      case 'open_app':
        return 1000; // 1s
      case 'open_url':
      case 'play_music':
      case 'search_web':
      case 'search_product':
      case 'file_open':
      case 'file_download':
        return 1500; // 1.5s
      case 'ocr_screen':
      case 'audit_screen_links':
      case 'scan_for_malware':
      case 'file_scan_for_malware':
      case 'file_scan':
      case 'summarize':
        return 2000; // 2s
      default:
        return 1000; // default 1s
    }
  }

  private isStepReversible(action: string): boolean {
    const irreversibleActions = [
      'open_app',
      'open_url',
      'system_power',
      'file_delete',
      'file_copy',
      'file_download',
    ];
    return !irreversibleActions.includes(action);
  }
}
