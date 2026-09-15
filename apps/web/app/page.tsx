import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_URL, apiFetch } from '@/lib/api';

interface HealthResult {
  status: string;
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string }>;
}

async function getApiHealth() {
  try {
    const result = await apiFetch<HealthResult>('/health');
    return result;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await getApiHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Digital Weboracle CRM</h1>
        <p className="mt-2 text-sm text-slate-500">
          Cloud CRM + Contact Center platform — engineering foundation milestone.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <h2 className="text-sm font-medium text-slate-700">API status</h2>
        </CardHeader>
        <CardContent>
          {health?.success ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-emerald-600">
                {health.data.status === 'ok' ? 'All systems operational' : health.data.status}
              </p>
              <ul className="text-slate-500">
                {Object.entries({ ...health.data.info, ...health.data.error }).map(
                  ([key, value]) => (
                    <li key={key}>
                      {key}: <span className="font-mono">{value.status}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-amber-600">
              Could not reach the API at <span className="font-mono">{API_URL}</span>. Is it
              running?
            </p>
          )}
        </CardContent>
      </Card>

      <Link href="/login">
        <Button>Go to login</Button>
      </Link>
    </main>
  );
}
