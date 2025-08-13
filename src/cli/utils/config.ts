import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { Config } from '../types/index.js';

const CONFIG_FILE = '.cliseorc.json';
const GLOBAL_CONFIG_FILE = join(homedir(), '.cliseorc');

const defaultConfig: Config = {
  aiModel: 'gpt-4',
  createPRs: true,
  seoDirectory: true,
  tracking: {
    anonymous: true,
    searchConsole: false,
  },
};

async function readConfigFile(path: string): Promise<Partial<Config>> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

export async function loadConfig(): Promise<Config> {
  // Load global config first
  const globalConfig = await readConfigFile(GLOBAL_CONFIG_FILE);
  
  // Load local config (if exists)
  const localConfig = await readConfigFile(CONFIG_FILE);
  
  // Merge configs with default, giving precedence to local over global
  return {
    ...defaultConfig,
    ...globalConfig,
    ...localConfig,
  };
}

export async function saveConfig(config: Partial<Config>, global = false): Promise<void> {
  const configPath = global ? GLOBAL_CONFIG_FILE : CONFIG_FILE;
  const existingConfig = await readConfigFile(configPath);
  
  const newConfig = {
    ...existingConfig,
    ...config,
  };
  
  await writeFile(configPath, JSON.stringify(newConfig, null, 2));
}

export async function updateConfig(updates: Partial<Config>, global = false): Promise<Config> {
  await saveConfig(updates, global);
  return loadConfig();
}

export async function getApiKey(key: 'openaiApiKey' | 'githubToken' | 'googleApiKey'): Promise<string | undefined> {
  const config = await loadConfig();
  return config[key];
}

export async function setApiKey(key: 'openaiApiKey' | 'githubToken' | 'googleApiKey', value: string): Promise<void> {
  await updateConfig({ [key]: value }, true); // Always save API keys in global config
}

// Authentication utilities for Auth0 tokens
interface AuthTokens {
  idToken: string;
  accessToken: string;
  email: string;
  aiAccess: boolean;
  expiresAt: number;
}

export async function getAuthTokens(): Promise<AuthTokens | undefined> {
  const config = await loadConfig();
  if (!config.auth0Tokens) return undefined;
  
  try {
    return JSON.parse(config.auth0Tokens);
  } catch {
    return undefined;
  }
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  await updateConfig({ 
    auth0Tokens: JSON.stringify(tokens),
    userEmail: tokens.email,
    aiAccess: tokens.aiAccess
  }, true); // Always save auth tokens in global config
}

export async function clearAuthTokens(): Promise<void> {
  await updateConfig({ 
    auth0Tokens: undefined,
    userEmail: undefined,
    aiAccess: undefined 
  }, true);
}

export async function getAuthToken(): Promise<string | undefined> {
  const tokens = await getAuthTokens();
  return tokens?.idToken;
}

export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getAuthTokens();
  if (!tokens) return false;
  
  // Check if token is expired
  if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
    return false;
  }
  
  return !!(tokens.idToken && tokens.email);
}

export async function hasAiAccess(): Promise<boolean> {
  const tokens = await getAuthTokens();
  return !!(tokens && tokens.aiAccess && tokens.idToken);
} 