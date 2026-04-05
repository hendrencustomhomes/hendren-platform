import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import JobEditForm from './JobEditForm';

type ContactSeed = {
  name: string;
  label: string;
  email: string;
  phone: string;
  is_primary: boolean;
  receives_notifications: boolean;
};

type ClientSeed = {
  id: string | null;
  name: string;
  client_kind: 'individual' | 'company';
  company_name: string | null;
  notes: string | null;
  isLegacyClient: boolean;
  job_client_contacts: ContactSeed[];
};

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

  const primaryClient =
    jobClients?.find((c) => c.is_primary) ??
    jobClients?.[0] ??
    null;

  const fallbackClient: ClientSeed = {
    id: null,
    name: job.client_name ?? '',
    client_kind: 'individual',
    company_name: null,
    notes: null,
    isLegacyClient: true,
    job_client_contacts: [
      {
        name: job.client_name ?? '',
        label: 'Primary',
        email: job.client_email ?? '',
        phone: job.client_phone ?? '',
        is_primary: true,
        receives_notifications: true,
      },
    ],
  };

  const clientForForm: ClientSeed = primaryClient
    ? {
        id: primaryClient.id,
        name: primaryClient.name ?? '',
        client_kind: primaryClient.client_kind ?? 'individual',
        company_name: primaryClient.company_name ?? null,
        notes: primaryClient.notes ?? null,
        isLegacyClient: false,
        job_client_contacts:
          primaryClient.job_client_contacts?.length > 0
            ? primaryClient.job_client_contacts.map((c: any) => ({
                name: c.name ?? '',
                label: c.label ?? '',
                email: c.email ?? '',
                phone: c.phone ?? '',
                is_primary: c.is_primary ?? false,
                receives_notifications: c.receives_notifications ?? true,
              }))
            : [
                {
                  name: primaryClient.name ?? '',
                  label: 'Primary',
                  email: '',
                  phone: '',
                  is_primary: true,
                  receives_notifications: true,
                },
              ],
      }
    : fallbackClient;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-xl font-semibold">Edit Job</h1>
      <JobEditForm job={job} client={clientForForm} />
    </div>
  );
}