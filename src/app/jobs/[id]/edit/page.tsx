import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import JobEditForm from './JobEditForm';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (jobError) {
    console.error('Edit page job query failed:', jobError);
    throw new Error(jobError.message);
  }

  if (!job) notFound();

  const { data: jobClients, error: jobClientsError } = await supabase
    .from('job_clients')
    .select(`
      *,
      job_client_contacts (*)
    `)
    .eq('job_id', id)
    .order('is_primary', { ascending: false });

  if (jobClientsError) {
    console.error('Edit page job clients query failed:', jobClientsError);
    throw new Error(jobClientsError.message);
  }

  const primaryClient = jobClients?.find((c) => c.is_primary) ?? jobClients?.[0] ?? null;

  if (!primaryClient) notFound();

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-xl font-semibold">Edit Job</h1>
      <JobEditForm job={job} client={primaryClient} />
    </div>
  );
}