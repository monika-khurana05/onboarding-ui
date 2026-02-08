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
      requestId: `msw-${Date.now()}`,
      message: 'Onboarding request submitted successfully (MSW).'
    });
  })
];
