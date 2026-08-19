import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/auth.store';

export default function PerfilRedirectRoute() {
  const getHomeRoute = useAuthStore((state) => state.getHomeRoute);

  return <Redirect href={getHomeRoute()} />;
}
