/**
 * Tool Routes
 * Exposes configured tool catalog, policy visibility, and provider tool capabilities.
 * Implements WP-07: Provider-native tools in catalog and policy.
 */

import { Router, Request, Response } from 'express';
import { getToolCatalog } from '../services/executionService';
import { getFeatureFlags } from '../../types';

const router = Router();

router.get('/catalog', async (req: Request<{}, {}, {}, { agentId?: string }>, res: Response) => {
  try {
    const catalog = await getToolCatalog(req.query.agentId);
    const flags = getFeatureFlags();

    // Enhance catalog items with provider tool capabilities
    const enhancedTools = catalog.tools.map((tool) => {
      const isProviderTool = tool.source === 'provider';
      return {
        ...tool,
        // WP-07: Include policy status and reason for disabled tools
        policyStatus: tool.enabled ? 'allowed' : 'denied',
        policyReason: tool.enabled
          ? undefined
          : `Tool ${tool.name} is denied by ${isProviderTool ? 'provider tool' : 'agent'} policy`,
        // Provider tools flag availability
        providerToolsEnabled: flags.FEATURE_PROVIDER_TOOLS && flags.FEATURE_EXTERNAL_AI_PROVIDERS
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        ...catalog,
        tools: enhancedTools,
        featureFlags: {
          providerTools: flags.FEATURE_PROVIDER_TOOLS,
          externalAiProviders: flags.FEATURE_EXTERNAL_AI_PROVIDERS,
          mcpSdkClient: flags.FEATURE_MCP_SDK_CLIENT,
          iotIntegrations: flags.FEATURE_IOT_INTEGRATIONS
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load tool catalog'
    });
  }
});

export default router;
