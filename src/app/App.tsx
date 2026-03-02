import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GoogleAuthProvider } from './auth/GoogleAuthContext';

export default function App() {
  return (
    <GoogleAuthProvider>
      <RouterProvider router={router} />
    </GoogleAuthProvider>
  );
}
