import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { AiPreviewProvider } from '../ai/AiPreviewContext';

export default function App() {
  return (
    <BrowserRouter>
      <AiPreviewProvider>
        <AppRoutes />
      </AiPreviewProvider>
    </BrowserRouter>
  );
}
