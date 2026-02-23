/**
 * IntegrationCatalogService
 * Provides feature-flagged IoT, MCP template, and provider integration visibility.
 */

import { getFeatureFlags } from '../../types';

export type IntegrationCategory = 'iot' | 'mcp' | 'provider';

export interface IntegrationCatalogItem {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  enabled: boolean;
  flag: keyof ReturnType<typeof getFeatureFlags>;
  sampleConfig: Record<string, unknown>;
}

const IOT_TEMPLATES: Omit<IntegrationCatalogItem, 'enabled'>[] = [
  {
    id: 'iot.arduino.mcp-template',
    name: 'Arduino MCP Template',
    category: 'iot',
    description: 'Template config for Arduino-focused MCP tool exposure.',
    flag: 'FEATURE_IOT_INTEGRATIONS',
    sampleConfig: {
      name: 'arduino-mcp',
      transport: 'stdio',
      command: 'node',
      args: ['tools/arduino-mcp.js']
    }
  },
  {
    id: 'iot.johnny-five.cli',
    name: 'Johnny-Five CLI Integration',
    category: 'iot',
    description: 'CLI execution profile for local Johnny-Five hardware control.',
    flag: 'FEATURE_IOT_INTEGRATIONS',
    sampleConfig: {
      executionMode: 'claude_cli',
      claude: {
        allowedCommands: ['node scripts/johnny-five-runner.js']
      }
    }
  },
  {
    id: 'iot.esp32.mcp',
    name: 'ESP32 MCP Integration',
    category: 'iot',
    description: 'MCP endpoint template for WiFi-connected ESP32 task automation.',
    flag: 'FEATURE_IOT_INTEGRATIONS',
    sampleConfig: {
      name: 'esp32-control',
      transport: 'http',
      url: 'http://esp32.local:8123/mcp'
    }
  },
  {
    id: 'iot.home-assistant.mcp',
    name: 'Home Assistant MCP',
    category: 'iot',
    description: 'Smart-home integration profile using Home Assistant MCP bridge.',
    flag: 'FEATURE_IOT_INTEGRATIONS',
    sampleConfig: {
      name: 'home-assistant',
      transport: 'http',
      url: 'http://homeassistant.local:3000/mcp'
    }
  }
];

const MCP_TEMPLATES: Omit<IntegrationCatalogItem, 'enabled'>[] = [
  {
    id: 'mcp.filesystem',
    name: 'Filesystem MCP',
    category: 'mcp',
    description: 'Advanced filesystem operations via MCP server.',
    flag: 'FEATURE_MCP_SDK_CLIENT',
    sampleConfig: {
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem']
    }
  },
  {
    id: 'mcp.github',
    name: 'GitHub MCP',
    category: 'mcp',
    description: 'Issue, PR, and repository automation through GitHub MCP.',
    flag: 'FEATURE_MCP_SDK_CLIENT',
    sampleConfig: {
      name: 'github',
      transport: 'http',
      url: 'https://api.githubcopilot.com/mcp/'
    }
  },
  {
    id: 'mcp.database',
    name: 'Database MCP',
    category: 'mcp',
    description: 'SQL/query tooling via MCP adapter for Postgres/Supabase.',
    flag: 'FEATURE_MCP_SDK_CLIENT',
    sampleConfig: {
      name: 'database',
      transport: 'http',
      url: 'http://localhost:4100/mcp'
    }
  },
  {
    id: 'mcp.browser.playwright',
    name: 'Browser MCP (Playwright)',
    category: 'mcp',
    description: 'Browser automation and scraping via Playwright MCP bridge.',
    flag: 'FEATURE_MCP_SDK_CLIENT',
    sampleConfig: {
      name: 'playwright',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest']
    }
  }
];

const PROVIDER_TEMPLATES: Omit<IntegrationCatalogItem, 'enabled'>[] = [
  {
    id: 'provider.anthropic',
    name: 'Anthropic',
    category: 'provider',
    description: 'Claude models routed through provider-native tool pathways.',
    flag: 'FEATURE_EXTERNAL_AI_PROVIDERS',
    sampleConfig: {
      providerTools: {
        enabled: true,
        allowedProviders: ['anthropic']
      }
    }
  },
  {
    id: 'provider.google',
    name: 'Google Gemini',
    category: 'provider',
    description: 'Gemini provider profile for model routing and policy checks.',
    flag: 'FEATURE_EXTERNAL_AI_PROVIDERS',
    sampleConfig: {
      providerTools: {
        enabled: true,
        allowedProviders: ['google']
      }
    }
  },
  {
    id: 'provider.local.ollama',
    name: 'Local Models (Ollama/LM Studio)',
    category: 'provider',
    description: 'Local model endpoint integration for vendor-neutral workloads.',
    flag: 'FEATURE_EXTERNAL_AI_PROVIDERS',
    sampleConfig: {
      providerTools: {
        enabled: true,
        allowedProviders: ['ollama']
      }
    }
  }
];

function withFlagState(items: Omit<IntegrationCatalogItem, 'enabled'>[]): IntegrationCatalogItem[] {
  const flags = getFeatureFlags();

  return items.map((item) => {
    let enabled = flags[item.flag];

    if (item.category === 'provider') {
      enabled = enabled && flags.FEATURE_PROVIDER_TOOLS;
    }

    return {
      ...item,
      enabled
    };
  });
}

export function getIntegrationCatalog(category?: IntegrationCategory): IntegrationCatalogItem[] {
  const all = [
    ...withFlagState(IOT_TEMPLATES),
    ...withFlagState(MCP_TEMPLATES),
    ...withFlagState(PROVIDER_TEMPLATES)
  ];

  if (!category) {
    return all;
  }

  return all.filter((item) => item.category === category);
}
