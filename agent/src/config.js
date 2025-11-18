import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load and validate agent configuration
 */
export function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      'Configuration file not found. Please copy config.example.json to config.json and add your API key.'
    );
  }

  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);

  // Validate required fields
  if (!config.apiKey || config.apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('API key not configured. Please update config.json with your API key.');
  }

  if (!config.serverUrl) {
    throw new Error('Server URL not configured in config.json');
  }

  // Set defaults
  config.logLevel = config.logLevel || 'info';
  config.agent = config.agent || {};
  config.agent.version = config.agent.version || '1.0.0';
  config.agent.platform = config.agent.platform || process.platform;

  return config;
}
