/**
 * App - Main application component
 * Agent Orchestration Platform
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './components';
import { SocketProvider } from './hooks/useSocket';

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
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <Dashboard />
      </SocketProvider>
    </QueryClientProvider>
  );
}

export default App;
