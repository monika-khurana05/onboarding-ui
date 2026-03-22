import { HttpResponse, delay, http } from 'msw';
import { mockCountries, mockTemplates, mockWorkflowRuns } from '../features/countries/mockData';

export const handlers = [
  http.get('*/countries', async () => {
    await delay(350);
    return HttpResponse.json(mockCountries);
  }),
  http.get('*/workflow-runs', async () => {
    await delay(300);
    return HttpResponse.json(mockWorkflowRuns);
  }),
  http.get('*/onboarding-templates', async () => {
    await delay(200);
    return HttpResponse.json(mockTemplates);
  }),
  http.post('*/onboarding-requests', async () => {
    await delay(650);
    return HttpResponse.json({
      requestId: 'msw-request-001',
      message: 'Onboarding request submitted successfully (MSW).'
    });
  }),
  http.post('*/fsm/submit', async () => {
    await delay(300);
    return HttpResponse.json({
      operationId: 'fsm-op-001',
      status: 'PENDING',
      pullRequestUrl: 'https://example.internal/pr/fsm-op-001'
    });
  }),
  http.post('*/onboarding/state-manager/scenarios', async ({ request }) => {
    await delay(250);
    const payload = (await request.json()) as {
      countryCode?: string;
      stateManagerConfig?: { lastUpdated?: string };
    };
    return HttpResponse.json({
      success: true,
      message: 'Scenario configuration saved successfully',
      configId: 'state-manager-config-001',
      updatedAt: payload.stateManagerConfig?.lastUpdated ?? new Date().toISOString(),
      countryCode: payload.countryCode
    });
  }),
  http.get('*/fsm/operation-status/:operationId', async ({ params }) => {
    await delay(250);
    return HttpResponse.json({
      operationId: String(params.operationId ?? 'fsm-op-001'),
      status: 'COMPLETED',
      pullRequestUrl: 'https://example.internal/pr/fsm-op-001'
    });
  })
];

