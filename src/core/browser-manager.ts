/**
 * Browser Manager for Browserbase and Stagehand integration.
 * 
 * This module provides a BrowserManager class that handles the lifecycle
 * of browser sessions using Browserbase infrastructure and Stagehand
 * for AI-powered browser automation.
 * 
 * @module core.browser-manager
 */

import { Stagehand } from '@browserbasehq/stagehand';
import type { Page } from '@browserbasehq/stagehand';
import { Logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { TIMEOUTS } from '../config/constants';

/**
 * Configuration for BrowserManager.
 */
export interface BrowserManagerConfig {
  /** Browserbase API key */
  apiKey: string;
  
  /** Browserbase project ID */
  projectId: string;
  
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional timeout for initialization (default: PAGE_NAVIGATION_TIMEOUT) */
  initTimeout?: number;
  
  /** Optional timeout for navigation (default: PAGE_NAVIGATION_TIMEOUT) */
  navigateTimeout?: number;
}

/**
 * Browser Manager class for managing Browserbase sessions and Stagehand automation.
 * 
 * Handles browser session lifecycle including initialization, navigation,
 * and cleanup. All operations are wrapped with timeouts to ensure
 * they don't exceed allocated time budgets.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const browser = new BrowserManager({
 *   apiKey: process.env.BROWSERBASE_API_KEY!,
 *   projectId: process.env.BROWSERBASE_PROJECT_ID!,
 *   logger,
 * });
 * 
 * const page = await browser.initialize();
 * await browser.navigate('https://example.com/game');
 * // ... use page for automation ...
 * await browser.cleanup();
 * ```
 */
export class BrowserManager {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly logger: Logger;
  private readonly initTimeout: number;
  private readonly navigateTimeout: number;
  
  private stagehand: Stagehand | null = null;
  private page: Page | null = null;
  private isInitialized: boolean = false;

  /**
   * Create a new BrowserManager instance.
   * 
   * @param config - Configuration object with API credentials and logger
   */
  constructor(config: BrowserManagerConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.logger = config.logger;
    this.initTimeout = config.initTimeout ?? TIMEOUTS.PAGE_NAVIGATION_TIMEOUT;
    this.navigateTimeout = config.navigateTimeout ?? TIMEOUTS.PAGE_NAVIGATION_TIMEOUT;
  }

  /**
   * Initialize browser session with Browserbase and Stagehand.
   * 
   * Creates a new Browserbase session and connects Stagehand for
   * AI-powered browser automation. This method must be called
   * before navigating or performing any browser operations.
   * 
   * @returns Promise that resolves to the Stagehand Page object
   * @throws {TimeoutError} If initialization exceeds timeout
   * @throws {Error} If initialization fails (invalid credentials, network error, etc.)
   * 
   * @example
   * ```typescript
   * const page = await browser.initialize();
   * // Now you can use page for automation
   * ```
   */
  async initialize(): Promise<Page> {
    if (this.isInitialized && this.page) {
      this.logger.warn('Browser already initialized', {});
      return this.page;
    }

    this.logger.info('Initializing browser session', {
      apiKey: this.apiKey.substring(0, 8) + '...', // Log partial key for debugging
      projectId: this.projectId,
    });

    try {
      // Create Stagehand instance with Browserbase configuration
      this.stagehand = new Stagehand({
        env: 'BROWSERBASE',
        apiKey: this.apiKey,
        projectId: this.projectId,
      });

      // Initialize Stagehand with timeout
      await withTimeout(
        this.stagehand.init(),
        this.initTimeout,
        `Browser initialization timed out after ${this.initTimeout}ms`
      );

      // Get page object from Stagehand
      this.page = this.stagehand.page;
      this.isInitialized = true;

      this.logger.info('Browser session initialized successfully', {
        pageUrl: typeof this.page.url === 'function' ? this.page.url() : 'about:blank',
      });

      return this.page;
    } catch (error) {
      this.logger.error('Failed to initialize browser session', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });

      // Reset state on error
      this.stagehand = null;
      this.page = null;
      this.isInitialized = false;

      throw error;
    }
  }

  /**
   * Navigate to a URL.
   * 
   * Navigates the browser to the specified URL and waits for network
   * idle state before resolving. This ensures the page has finished
   * loading before proceeding with automation.
   * 
   * @param url - The URL to navigate to
   * @throws {TimeoutError} If navigation exceeds timeout
   * @throws {Error} If navigation fails or browser is not initialized
   * 
   * @example
   * ```typescript
   * await browser.navigate('https://example.com/game');
   * ```
   */
  async navigate(url: string): Promise<void> {
    if (!this.isInitialized || !this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.logger.info('Navigating to URL', { url });

    try {
      await withTimeout(
        this.page.goto(url, { waitUntil: 'networkidle' }),
        this.navigateTimeout,
        `Navigation to ${url} timed out after ${this.navigateTimeout}ms`
      );

      this.logger.info('Navigation completed successfully', {
        url,
        finalUrl: typeof this.page.url === 'function' ? this.page.url() : url,
      });
    } catch (error) {
      this.logger.error('Navigation failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });

      throw error;
    }
  }

  /**
   * Cleanup browser session and release resources.
   * 
   * Closes the browser session and cleans up all resources.
   * This method should be called when finished with browser automation
   * to ensure proper cleanup and avoid resource leaks.
   * 
   * Errors during cleanup are logged but not thrown to prevent
   * masking more important errors.
   * 
   * @example
   * ```typescript
   * await browser.cleanup();
   * ```
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized || !this.page) {
      this.logger.debug('No browser session to cleanup', {});
      return;
    }

    this.logger.info('Cleaning up browser session', {});

    try {
      // Close the page
      if (this.page) {
        await this.page.close();
      }

      // Reset state
      this.page = null;
      this.stagehand = null;
      this.isInitialized = false;

      this.logger.info('Browser session cleaned up successfully', {});
    } catch (error) {
      // Log error but don't throw - cleanup should be best-effort
      this.logger.warn('Error during browser cleanup', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });

      // Reset state even if cleanup failed
      this.page = null;
      this.stagehand = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get the current page object.
   * 
   * Returns the Stagehand Page object if browser is initialized,
   * or null if not initialized.
   * 
   * @returns Page object or null
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Check if browser is initialized.
   * 
   * @returns True if browser is initialized, false otherwise
   */
  isBrowserInitialized(): boolean {
    return this.isInitialized;
  }
}

