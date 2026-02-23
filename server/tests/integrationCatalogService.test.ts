import { getIntegrationCatalog } from '../src/services/integrationCatalogService';

describe('integrationCatalogService', () => {
  beforeEach(() => {
    delete process.env.FEATURE_IOT_INTEGRATIONS;
    delete process.env.FEATURE_MCP_SDK_CLIENT;
    delete process.env.FEATURE_PROVIDER_TOOLS;
    delete process.env.FEATURE_EXTERNAL_AI_PROVIDERS;
  });

  it('returns catalog with disabled items when flags are off', () => {
    const catalog = getIntegrationCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.every((item) => item.enabled === false)).toBe(true);
  });

  it('enables provider items only when both provider flags are set', () => {
    process.env.FEATURE_PROVIDER_TOOLS = 'true';
    process.env.FEATURE_EXTERNAL_AI_PROVIDERS = 'true';

    const providers = getIntegrationCatalog('provider');
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.every((item) => item.enabled === true)).toBe(true);
  });
});
