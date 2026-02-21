/**
 * App - Main application component
 * Agent Orchestration Platform
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './components';
import { useSocket } from './hooks/useSocket';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function App() {
  // Initialize socket connection on app load
  useSocket();

  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

export default App;
