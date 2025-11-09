/**
 * Browser Manager for Browserbase and Stagehand integration.
 * 
 * This module provides a BrowserManager class that handles the lifecycle
 * of browser sessions using Browserbase infrastructure and Stagehand
 * for AI-powered browser automation.
 * 
 * @module core.browser-manager
 */

import { Stagehand, type AnyPage } from '@browserbasehq/stagehand';
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
  private page: AnyPage | null = null;
  private isInitialized: boolean = false;
  private sessionId: string | null = null;

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
  async initialize(): Promise<AnyPage> {
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

      // Get page object from Stagehand v3 context
      // v3 uses context API - get active page or first page from context
      const activePage = this.stagehand.context.activePage();
      if (!activePage) {
        const pages = this.stagehand.context.pages();
        if (pages.length === 0) {
          throw new Error('No pages available after initialization');
        }
        this.page = pages[0];
      } else {
        this.page = activePage;
      }
      this.isInitialized = true;

      // Extract session ID from Stagehand (if available)
      // Stagehand may expose session info through its internal state
      try {
        const stagehandAny = this.stagehand as any;
        // Try various possible locations for session ID
        if (stagehandAny.sessionId) {
          this.sessionId = stagehandAny.sessionId;
        } else if (stagehandAny._sessionId) {
          this.sessionId = stagehandAny._sessionId;
        } else if (stagehandAny.session?.id) {
          this.sessionId = stagehandAny.session.id;
        } else if (stagehandAny._session?.id) {
          this.sessionId = stagehandAny._session.id;
        } else if (stagehandAny.browserbaseSessionId) {
          this.sessionId = stagehandAny.browserbaseSessionId;
        } else if (stagehandAny._browserbaseSessionId) {
          this.sessionId = stagehandAny._browserbaseSessionId;
        }
        
        // If still no session ID, try to get it from Browserbase API
        // by listing recent sessions and finding the most recent one
        if (!this.sessionId) {
          this.sessionId = await this.getSessionIdFromBrowserbase();
        }
      } catch (error) {
        // Session ID extraction is optional, don't fail if it doesn't work
        this.logger.debug('Could not extract session ID from Stagehand', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      this.logger.info('Browser session initialized successfully', {
        pageUrl: typeof this.page.url === 'function' ? this.page.url() : 'about:blank',
        sessionId: this.sessionId,
      });

      // Try to open debugger URL automatically
      await this.openDebuggerUrl();

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
      // Stagehand v3 Page type - use type assertion since we know Browserbase uses Stagehand Page
      const page = this.page as any;
      await withTimeout(
        page.goto(url, { waitUntil: 'networkidle' }),
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
  getPage(): AnyPage | null {
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

  /**
   * Get session ID from Browserbase API.
   * 
   * Attempts to get the session ID by listing recent sessions from Browserbase
   * and finding the most recent one for this project.
   * 
   * @returns Promise that resolves to session ID or null if not available
   */
  private async getSessionIdFromBrowserbase(): Promise<string | null> {
    try {
      // List recent sessions from Browserbase API
      const response = await fetch(
        `https://api.browserbase.com/v1/sessions?projectId=${this.projectId}&limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-bb-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        this.logger.debug('Failed to get session ID from Browserbase', {
          statusCode: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = await response.json();
      
      // Get the most recent session
      if (data.sessions && data.sessions.length > 0) {
        const session = data.sessions[0];
        if (session.id && session.status === 'RUNNING') {
          this.logger.debug('Session ID retrieved from Browserbase API', {
            sessionId: session.id,
          });
          return session.id;
        }
      }

      return null;
    } catch (error) {
      this.logger.debug('Failed to retrieve session ID from Browserbase', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get debugger URL from Browserbase session.
   * 
   * Retrieves the debugger URL from the Browserbase API for the current session.
   * This allows opening the browser debugger to inspect the session.
   * 
   * @returns Promise that resolves to debugger URL or null if not available
   */
  async getDebuggerUrl(): Promise<string | null> {
    if (!this.sessionId) {
      this.logger.debug('No session ID available for debugger URL', {});
      return null;
    }

    try {
      // Call Browserbase API to get debug info
      const response = await fetch(
        `https://api.browserbase.com/v1/sessions/${this.sessionId}/debug`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-bb-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        this.logger.warn('Failed to get debugger URL from Browserbase', {
          statusCode: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const debugInfo = await response.json();
      
      // Prefer debuggerFullscreenUrl, fallback to debuggerUrl
      const debuggerUrl = debugInfo.debuggerFullscreenUrl || debugInfo.debuggerUrl;
      
      if (debuggerUrl) {
        this.logger.info('Debugger URL retrieved', {
          debuggerUrl,
          hasFullscreen: !!debugInfo.debuggerFullscreenUrl,
        });
        return debuggerUrl;
      }

      this.logger.warn('Debugger URL not found in Browserbase response', {
        debugInfo: Object.keys(debugInfo),
      });
      return null;
    } catch (error) {
      this.logger.warn('Failed to retrieve debugger URL', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Open debugger URL in browser.
   * 
   * Attempts to open the Browserbase debugger URL in Cursor IDE's browser tab if available,
   * otherwise falls back to the default system browser.
   * This is a best-effort operation - failures are logged but don't throw errors.
   * 
   * @param url - Optional debugger URL (if not provided, will fetch it)
   */
  async openDebuggerUrl(url?: string): Promise<void> {
    try {
      const debuggerUrl = url || await this.getDebuggerUrl();
      
      if (!debuggerUrl) {
        this.logger.debug('No debugger URL available to open', {});
        return;
      }

      // Check if we should use Cursor IDE browser (via environment variable)
      const useCursorBrowser = process.env.USE_CURSOR_BROWSER === 'true' || 
                               process.env.CURSOR_BROWSER === 'true';

      if (useCursorBrowser) {
        // Try to use Cursor IDE browser via MCP
        // Note: This requires the MCP browser server to be available
        // If not available, we'll fall back to system browser
        try {
          // Check if we're in a Cursor environment by checking for CURSOR_* env vars
          const cursorEnv = process.env.CURSOR_SESSION_ID || process.env.CURSOR_WORKSPACE;
          
          if (cursorEnv) {
            this.logger.info('Attempting to open debugger URL in Cursor IDE browser', {
              debuggerUrl,
            });
            
            // Log the URL for Cursor to pick up, or use a Cursor-specific mechanism
            // Since MCP tools aren't directly callable from user code, we'll log it
            // and suggest the user can manually open it, or we can try a Cursor command
            this.logger.info('Debugger URL for Cursor IDE browser', {
              debuggerUrl,
              note: 'Open this URL in Cursor IDE browser tab',
            });
            
            // Try to use cursor command if available (Cursor CLI)
            try {
              const cursorCommand = Bun.spawn(['cursor', '--open-url', debuggerUrl], {
                stdio: ['ignore', 'ignore', 'ignore'],
              });
              // Don't wait for it
              this.logger.info('Debugger URL opened via Cursor CLI', {
                debuggerUrl,
              });
              return;
            } catch {
              // Cursor CLI not available, fall through to system browser
              this.logger.debug('Cursor CLI not available, falling back to system browser');
            }
          }
        } catch (error) {
          this.logger.debug('Failed to use Cursor browser, falling back to system browser', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Fall back to system default browser
      const platform = process.platform;

      let command: string;
      let args: string[];

      if (platform === 'darwin') {
        // macOS
        command = 'open';
        args = [debuggerUrl];
      } else if (platform === 'win32') {
        // Windows
        command = 'cmd';
        args = ['/c', 'start', debuggerUrl];
      } else {
        // Linux and others
        command = 'xdg-open';
        args = [debuggerUrl];
      }

      // Use Bun's spawn API to open URL in default browser
      // Spawn the process and don't wait for it to complete
      Bun.spawn([command, ...args], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      
      // Note: The process will run in the background and open the browser
      // We don't need to wait for it or track it
      
      this.logger.info('Debugger URL opened in system browser', {
        debuggerUrl,
        platform,
      });
    } catch (error) {
      // Log error but don't throw - opening debugger is optional
      this.logger.warn('Failed to open debugger URL', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

