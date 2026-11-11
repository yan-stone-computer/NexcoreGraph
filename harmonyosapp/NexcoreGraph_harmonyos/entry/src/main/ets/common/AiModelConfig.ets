/* Runtime model-platform configuration. The API key is sent only to the self-hosted backend. */

import { http } from '@kit.NetworkKit';
import { callJson, callJsonWithHeaders } from './Backend';

export class ProviderOption {
  id: string = '';
  label: string = '';
}

export class GatewayModelConfig {
  provider: string = 'agnes';
  providerLabel: string = '';
  baseUrl: string = '';
  model: string = '';
  modelAlt: string = '';
  visionModels: string = '';
  timeoutMs: number = 30000;
  rpm: number = 20;
  visionBudgetMs: number = 25000;
  visionMaxTokens: number = 900;
  hasApiKey: boolean = false;
  maskedKey: string = '';
  providers: ProviderOption[] = [];
  apiKey: string = '';
  adminToken: string = '';
}

export function loadAiModelConfig(): Promise<GatewayModelConfig> {
  return callJson('/api/ai/config', http.RequestMethod.GET, '', 5000, 10000)
    .then((text: string): GatewayModelConfig => {
      const raw = JSON.parse(text) as Record<string, Object>;
      const cfg = new GatewayModelConfig();
      cfg.provider = String(raw['provider'] ?? 'agnes');
      cfg.providerLabel = String(raw['providerLabel'] ?? '');
      cfg.baseUrl = String(raw['baseUrl'] ?? '');
      cfg.model = String(raw['model'] ?? '');
      cfg.modelAlt = String(raw['modelAlt'] ?? '');
      cfg.visionModels = Array.isArray(raw['visionModels'])
        ? (raw['visionModels'] as string[]).join(',') : String(raw['visionModels'] ?? '');
      cfg.timeoutMs = Number(raw['timeoutMs'] ?? 30000);
      cfg.rpm = Number(raw['rpm'] ?? 20);
      cfg.visionBudgetMs = Number(raw['visionBudgetMs'] ?? 25000);
      cfg.visionMaxTokens = Number(raw['visionMaxTokens'] ?? 900);
      cfg.hasApiKey = Boolean(raw['hasApiKey'] ?? false);
      cfg.maskedKey = String(raw['maskedKey'] ?? '');
      const providers = raw['providers'];
      if (Array.isArray(providers)) {
        (providers as Record<string, Object>[]).forEach((p: Record<string, Object>): void => {
          const opt = new ProviderOption();
          opt.id = String(p['id'] ?? '');
          opt.label = String(p['label'] ?? '');
          cfg.providers.push(opt);
        });
      }
      return cfg;
    });
}

export function saveAiModelConfig(cfg: GatewayModelConfig): Promise<GatewayModelConfig> {
  const body: Record<string, Object> = {
    'provider': cfg.provider,
    'baseUrl': cfg.baseUrl,
    'model': cfg.model,
    'modelAlt': cfg.modelAlt,
    'visionModels': cfg.visionModels,
    'timeoutMs': cfg.timeoutMs,
    'rpm': cfg.rpm,
    'visionBudgetMs': cfg.visionBudgetMs,
    'visionMaxTokens': cfg.visionMaxTokens
  };
  if (cfg.apiKey.trim() !== '') {
    body['apiKey'] = cfg.apiKey.trim();
  }
  const headers: Record<string, string> = { 'X-AI-Admin-Token': cfg.adminToken.trim() };
  return callJsonWithHeaders('/api/ai/config', http.RequestMethod.POST, JSON.stringify(body),
    6000, 12000, headers).then((text: string): GatewayModelConfig => {
    const raw = JSON.parse(text) as Record<string, Object>;
    const out = new GatewayModelConfig();
    out.provider = String(raw['provider'] ?? cfg.provider);
    out.providerLabel = String(raw['providerLabel'] ?? '');
    out.baseUrl = String(raw['baseUrl'] ?? cfg.baseUrl);
    out.model = String(raw['model'] ?? cfg.model);
    out.modelAlt = String(raw['modelAlt'] ?? cfg.modelAlt);
    out.visionModels = Array.isArray(raw['visionModels'])
      ? (raw['visionModels'] as string[]).join(',') : String(raw['visionModels'] ?? '');
    out.hasApiKey = Boolean(raw['hasApiKey'] ?? false);
    out.maskedKey = String(raw['maskedKey'] ?? '');
    out.providers = cfg.providers;
    return out;
  });
}
