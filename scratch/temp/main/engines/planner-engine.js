"use strict";
// ============================================================
// JARVIS Guardian AI — Planner Engine
// Multi-step action planner for complex intents
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerEngine = void 0;
/**
 * Translates parsed intents into executable action plans.
 *
 * Simple intents (e.g., "open Chrome") produce single-step plans.
 * Complex intents (e.g., "search iPhone on Amazon") produce multi-step
 * plans with ordered dependencies.
 *
 * @example
 * ```ts
 * const planner = new PlannerEngine()
 * const plan = planner.plan(parsedIntent)
 * for (const step of plan.steps) {
 *   await actionEngine.execute(step)
 * }
 * ```
 */
class PlannerEngine {
    /**
     * Creates an action plan from a parsed intent.
     *
     * Routes the intent to the appropriate planning strategy based on
     * the intent type, then returns an ordered plan of executable steps.
     *
     * @param intent - The parsed intent to plan for
     * @returns An action plan with steps, ordering requirements, and risk levels
     */
    plan(intent) {
        switch (intent.intent) {
            case 'open_app':
                return this.planOpenApp(intent);
            case 'open_url':
                return this.planOpenUrl(intent);
            case 'search_web':
                return this.planSearchWeb(intent);
            case 'play_music':
                return this.planPlayMusic(intent);
            case 'search_product':
                return this.planSearchProduct(intent);
            case 'summarize':
                return this.planSummarize(intent);
            case 'system_control':
                return this.planSystemControl(intent);
            case 'file_operation':
                return this.planFileOperation(intent);
            case 'unknown':
            default:
                return this.planUnknown(intent);
        }
    }
    /**
     * Plans an open_app intent — single-step.
     */
    planOpenApp(intent) {
        const appName = intent.entities.app_name ?? 'unknown';
        return {
            steps: [
                {
                    action: 'open_app',
                    params: { app_name: appName },
                    risk_level: intent.risk_level,
                    description: `Open the application "${appName}"`
                }
            ],
            requires_sequential: false
        };
    }
    /**
     * Plans an open_url intent — single-step.
     */
    planOpenUrl(intent) {
        const url = intent.entities.url ?? '';
        return {
            steps: [
                {
                    action: 'open_url',
                    params: { url },
                    risk_level: intent.risk_level,
                    description: `Open URL: ${url}`
                }
            ],
            requires_sequential: false
        };
    }
    /**
     * Plans a search_web intent — single-step (open default browser with query).
     */
    planSearchWeb(intent) {
        const query = intent.entities.query ?? '';
        const website = intent.entities.website;
        if (website) {
            // Site-specific search: open site, then search
            return {
                steps: [
                    {
                        action: 'open_url',
                        params: { url: this.buildSiteSearchUrl(website, query) },
                        risk_level: 0,
                        description: `Search "${query}" on ${website}`
                    }
                ],
                requires_sequential: false
            };
        }
        return {
            steps: [
                {
                    action: 'search_web',
                    params: { query },
                    risk_level: 0,
                    description: `Search the web for "${query}"`
                }
            ],
            requires_sequential: false
        };
    }
    /**
     * Plans a play_music intent — handles platform routing.
     */
    planPlayMusic(intent) {
        const song = intent.entities.song ?? intent.entities.query ?? 'music';
        const platform = (intent.entities.platform ?? 'spotify').toLowerCase();
        return {
            steps: [
                {
                    action: 'play_music',
                    params: { song, platform },
                    risk_level: 0,
                    description: `Play "${song}" on ${platform}`
                }
            ],
            requires_sequential: false
        };
    }
    /**
     * Plans a search_product intent — multi-step: open site + search.
     * E.g., "search iPhone on Amazon" → open Amazon, search for iPhone.
     */
    planSearchProduct(intent) {
        const query = intent.entities.query ?? '';
        const website = (intent.entities.website ?? 'amazon').toLowerCase();
        const siteUrl = this.getProductSiteUrl(website);
        const searchUrl = this.buildProductSearchUrl(website, query);
        // If we can build a direct search URL, do it in one step
        if (searchUrl) {
            return {
                steps: [
                    {
                        action: 'open_url',
                        params: { url: searchUrl },
                        risk_level: 0,
                        description: `Search "${query}" on ${website}`
                    }
                ],
                requires_sequential: false
            };
        }
        // Fallback: open site, then manual search
        return {
            steps: [
                {
                    action: 'open_url',
                    params: { url: siteUrl },
                    risk_level: 0,
                    description: `Open ${website}`
                },
                {
                    action: 'search_for',
                    params: { query, website },
                    risk_level: 0,
                    description: `Search for "${query}" on ${website}`
                }
            ],
            requires_sequential: true
        };
    }
    /**
     * Plans a summarize intent — typically single-step local processing.
     */
    planSummarize(intent) {
        const query = intent.entities.query ?? '';
        const url = intent.entities.url;
        const steps = [];
        if (url) {
            steps.push({
                action: 'open_url',
                params: { url },
                risk_level: 0,
                description: `Open source URL: ${url}`
            });
        }
        steps.push({
            action: 'summarize',
            params: {
                query,
                ...(url ? { url } : {})
            },
            risk_level: intent.risk_level,
            description: `Summarize: ${query || url || 'content'}`
        });
        return {
            steps,
            requires_sequential: steps.length > 1
        };
    }
    /**
     * Plans a system_control intent — single-step system action.
     */
    planSystemControl(intent) {
        const action = intent.entities.action ?? 'unknown';
        // Map common system controls to actions
        const params = { action };
        // Include any numeric values (e.g., volume level)
        if (intent.entities.query) {
            params.value = intent.entities.query;
        }
        return {
            steps: [
                {
                    action: this.mapSystemControlAction(action),
                    params,
                    risk_level: intent.risk_level,
                    description: `System control: ${action}`
                }
            ],
            requires_sequential: false
        };
    }
    /**
     * Plans a file_operation intent — single-step file action.
     */
    planFileOperation(intent) {
        const action = intent.entities.action ?? 'search';
        const filePath = intent.entities.file_path ?? '';
        const query = intent.entities.query ?? '';
        if (action === 'search' || action === 'find') {
            return {
                steps: [
                    {
                        action: 'search_files',
                        params: { query: query || filePath },
                        risk_level: 0,
                        description: `Search for files matching "${query || filePath}"`
                    }
                ],
                requires_sequential: false
            };
        }
        return {
            steps: [
                {
                    action: `file_${action}`,
                    params: { file_path: filePath, query },
                    risk_level: intent.risk_level,
                    description: `File operation: ${action} on "${filePath || query}"`
                }
            ],
            requires_sequential: false
        };
    }
    /**
     * Plans for unknown intents — no-op with informative step.
     */
    planUnknown(intent) {
        return {
            steps: [
                {
                    action: 'noop',
                    params: { query: intent.entities.query ?? '' },
                    risk_level: 0,
                    description: 'Could not determine a specific action for this request'
                }
            ],
            requires_sequential: false
        };
    }
    // ─── Utility Methods ────────────────────────────────────────
    /**
     * Builds a site-specific search URL.
     * @param website - The website name
     * @param query - The search query
     * @returns A full search URL
     */
    buildSiteSearchUrl(website, query) {
        const encoded = encodeURIComponent(query);
        const site = website.toLowerCase();
        const searchUrls = {
            google: `https://www.google.com/search?q=${encoded}`,
            youtube: `https://www.youtube.com/results?search_query=${encoded}`,
            github: `https://github.com/search?q=${encoded}`,
            stackoverflow: `https://stackoverflow.com/search?q=${encoded}`,
            reddit: `https://www.reddit.com/search/?q=${encoded}`,
            wikipedia: `https://en.wikipedia.org/wiki/Special:Search?search=${encoded}`
        };
        return searchUrls[site] ?? `https://www.google.com/search?q=${encoded}+site:${site}`;
    }
    /**
     * Gets the base URL for a product search website.
     * @param website - The website name
     * @returns The base URL
     */
    getProductSiteUrl(website) {
        const sites = {
            amazon: 'https://www.amazon.com',
            ebay: 'https://www.ebay.com',
            flipkart: 'https://www.flipkart.com',
            walmart: 'https://www.walmart.com',
            bestbuy: 'https://www.bestbuy.com',
            target: 'https://www.target.com',
            etsy: 'https://www.etsy.com'
        };
        return sites[website] ?? `https://www.${website}.com`;
    }
    /**
     * Builds a product search URL for known e-commerce sites.
     * @param website - The website name
     * @param query - The search query
     * @returns Search URL or null if site is not recognized
     */
    buildProductSearchUrl(website, query) {
        const encoded = encodeURIComponent(query);
        const searchUrls = {
            amazon: `https://www.amazon.com/s?k=${encoded}`,
            ebay: `https://www.ebay.com/sch/i.html?_nkw=${encoded}`,
            flipkart: `https://www.flipkart.com/search?q=${encoded}`,
            walmart: `https://www.walmart.com/search?q=${encoded}`,
            bestbuy: `https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}`,
            target: `https://www.target.com/s?searchTerm=${encoded}`,
            etsy: `https://www.etsy.com/search?q=${encoded}`
        };
        return searchUrls[website] ?? null;
    }
    /**
     * Maps a system control action name to the engine action identifier.
     * @param action - The user-provided action name
     * @returns The engine action identifier
     */
    mapSystemControlAction(action) {
        const mapping = {
            volume: 'set_volume',
            set_volume: 'set_volume',
            mute: 'set_volume',
            unmute: 'set_volume',
            brightness: 'set_brightness',
            dark_mode: 'set_appearance',
            light_mode: 'set_appearance',
            shutdown: 'system_power',
            restart: 'system_power',
            sleep: 'system_power',
            lock: 'system_power',
            logout: 'system_power'
        };
        return mapping[action] ?? action;
    }
}
exports.PlannerEngine = PlannerEngine;
