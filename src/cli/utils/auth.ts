import { exec } from 'child_process';
import { createServer, Server } from 'http';
import { URL } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { setAuthToken, clearAuthToken, getAuthToken } from './config.js';
import { AuthenticationResult } from '../types/index.js';

// Auth0 and backend configuration
const AUTH0_DOMAIN = 'auth.cliseo.com';
const CLIENT_ID = 'kCZh9ll7L7RItLWLc47aOmDbffjQTmNd';
const REDIRECT_URI = 'http://localhost:8080/callback';
const API_BASE = 'https://a8iza6csua.execute-api.us-east-2.amazonaws.com';

interface AuthCallbackData {
  code?: string;
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Opens a URL in the default browser
 */
function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Creates a local server to handle OAuth callback
 */
function createAuthServer(): Promise<{ server: Server; port: number; authPromise: Promise<AuthCallbackData> }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    
    let authResolve: (data: AuthCallbackData) => void;
    let authReject: (error: Error) => void;
    
    const authPromise = new Promise<AuthCallbackData>((res, rej) => {
      authResolve = res;
      authReject = rej;
    });

    server.on('request', (req, res) => {
      if (!req.url) return;

      const url = new URL(req.url, `http://localhost`);
      
      if (url.pathname === '/callback') {
        // Handle OAuth callback
        const params = url.searchParams;
        const authData: AuthCallbackData = {};

        // Check for authorization code flow
        if (params.has('code')) {
          authData.code = params.get('code') || undefined;
        }
        
        // Check for implicit flow tokens
        if (params.has('access_token')) {
          authData.access_token = params.get('access_token') || undefined;
        }
        
        if (params.has('id_token')) {
          authData.id_token = params.get('id_token') || undefined;
        }

        // Check for errors
        if (params.has('error')) {
          authData.error = params.get('error') || undefined;
          authData.error_description = params.get('error_description') || undefined;
        }

        // Send response to browser
        const responseHtml = authData.error ? `
          <html>
            <head><title>cliseo - Authentication Failed</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #e74c3c;">Authentication Failed</h1>
              <p>Error: ${authData.error}</p>
              <p>${authData.error_description || ''}</p>
              <p>You can close this window and try again.</p>
            </body>
          </html>
        ` : `
          <html>
            <head><title>cliseo - Authentication Successful</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #27ae60;">Authentication Successful!</h1>
              <p>You have successfully authenticated with cliseo.</p>
              <p>You can now close this window and return to your terminal.</p>
              <script>
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
          </html>
        `;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(responseHtml);

        // Resolve the auth promise
        authResolve(authData);
      } else {
        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(8080, 'localhost', () => {
      resolve({ server, port: 8080, authPromise });
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Exchange authorization code for tokens using Auth0
 */
async function exchangeCodeForTokens(code: string): Promise<{ access_token: string; id_token: string }> {
  try {
    const response = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }
}

/**
 * Exchange Auth0 token for CLI token
 */
async function getCliToken(auth0Token: string): Promise<{ token: string; email: string; aiAccess: boolean; emailVerified: boolean; requiresVerification: boolean }> {
  try {
    const response = await axios.post(`${API_BASE}/cli-auth`, {}, {
      headers: {
        'Authorization': `Bearer ${auth0Token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data;
    return {
      token: data.token,
      email: data.email,
      aiAccess: data.ai_access,
      emailVerified: data.email_verified,
      requiresVerification: data.requires_verification,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;
      throw new Error(errorData.error || 'Authentication failed');
    }
    throw new Error('Failed to authenticate with cliseo backend');
  }
}

/**
 * Main authentication function using browser OAuth flow
 */
export async function authenticateUser(): Promise<AuthenticationResult> {
  const spinner = ora('Starting authentication...').start();
  
  try {
    // Create local server for OAuth callback
    spinner.text = 'Setting up authentication server...';
    const { server, authPromise } = await createAuthServer();

    // Build Auth0 authorization URL
    const authUrl = `https://${AUTH0_DOMAIN}/authorize?` + new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid profile email',
      // audience: `https://${AUTH0_DOMAIN}/userinfo`, // Removed - not needed for basic Auth0 setup
    }).toString();

    // Open browser
    spinner.text = 'Opening browser...';
    try {
      await openBrowser(authUrl);
      spinner.stop();
      console.log(chalk.gray(`If the browser doesn't open, visit: ${authUrl}\n`));
      spinner.start('Waiting for authentication...');
    } catch (error) {
      spinner.stop();
      console.log(chalk.yellow('\n⚠️  Could not open browser automatically.'));
      console.log(chalk.cyan('Please visit the following URL to authenticate:'));
      console.log(chalk.blue(authUrl));
      console.log('');
      spinner.start('Waiting for authentication...');
    }

    // Wait for OAuth callback
    spinner.text = 'Waiting for authentication...';
    const authData = await authPromise;
    
    // Close the server
    server.close();

    // Handle authentication errors
    if (authData.error) {
      spinner.fail('Authentication failed');
      return {
        success: false,
        error: authData.error_description || authData.error,
      };
    }

    // Exchange authorization code for tokens
    if (!authData.code) {
      spinner.fail('Authentication failed');
      return {
        success: false,
        error: 'No authorization code received',
      };
    }

    spinner.text = 'Exchanging authorization code for tokens...';
    const tokens = await exchangeCodeForTokens(authData.code);

    // Get CLI token from backend
    spinner.text = 'Getting CLI authentication token...';
    const cliAuth = await getCliToken(tokens.id_token);

    // Store authentication data
    await setAuthToken(cliAuth.token, cliAuth.email, cliAuth.aiAccess);

    spinner.succeed('Authentication successful!');
    
    return {
      success: true,
      token: cliAuth.token,
      email: cliAuth.email,
      aiAccess: cliAuth.aiAccess,
      emailVerified: cliAuth.emailVerified,
      requiresVerification: cliAuth.requiresVerification,
    };

  } catch (error) {
    spinner.fail('Authentication failed');
    
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred during authentication',
    };
  }
}

/**
 * Verify current authentication status
 */
export async function verifyAuthentication(): Promise<boolean> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return false;
    }

    const response = await axios.post(`${API_BASE}/verify-cli-token`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.valid === true;
  } catch (error) {
    return false;
  }
}

/**
 * Logout user by clearing stored tokens
 */
export async function logoutUser(): Promise<void> {
  await clearAuthToken();
} 