import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GoogleAuthProvider } from './auth/GoogleAuthContext';
import { TenantProvider } from './context/TenantContext';

export default function App() {
  return (
    <GoogleAuthProvider>
      <TenantProvider>
        <RouterProvider router={router} />
      </TenantProvider>
    </GoogleAuthProvider>
  );
}
