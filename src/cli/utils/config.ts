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

// Authentication utilities
export async function getAuthToken(): Promise<string | undefined> {
  const config = await loadConfig();
  return config.authToken;
}

export async function setAuthToken(token: string, email: string, aiAccess: boolean): Promise<void> {
  await updateConfig({ 
    authToken: token,
    userEmail: email,
    aiAccess 
  }, true); // Always save auth token in global config
}

export async function clearAuthToken(): Promise<void> {
  await updateConfig({ 
    authToken: undefined,
    userEmail: undefined,
    aiAccess: undefined 
  }, true);
}

export async function isAuthenticated(): Promise<boolean> {
  const config = await loadConfig();
  return !!(config.authToken && config.userEmail);
}

export async function hasAiAccess(): Promise<boolean> {
  const config = await loadConfig();
  return !!(config.authToken && config.aiAccess);
} 