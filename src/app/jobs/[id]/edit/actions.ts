'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

type ContactInput = {
  name: string;
  label?: string;
  email?: string;
  phone?: string;
  is_primary?: boolean;
  receives_notifications?: boolean;
};

type UpdateJobInput = {
  job_id: string;
  job_name: string;
  project_address: string;
  sqft?: number | null;
  lot_sqft?: number | null;
  referral_source?: string;
  scope_notes?: string;
  color?: string;
  client: {
    id: string;
    name: string;
    client_kind: 'individual' | 'company';
    company_name?: string;
    notes?: string;
    contacts: ContactInput[];
  };
};

function normalizeOptionalString(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredString(value: string | null | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${fieldName} is required.`);
  return trimmed;
}

function normalizeOptionalNumber(value?: number | null): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

export async function updateJobWithClient(input: UpdateJobInput) {
  const supabase = await createClient();

  const clientName = normalizeRequiredString(input.client.name, 'Client name');

  const { error: jobError } = await supabase
    .from('jobs')
    .update({
      job_name: normalizeRequiredString(input.job_name, 'Job name'),
      client_name: clientName,
      project_address: normalizeRequiredString(input.project_address, 'Project address'),
      sqft: normalizeOptionalNumber(input.sqft),
      lot_sqft: normalizeOptionalNumber(input.lot_sqft),
      referral_source: normalizeOptionalString(input.referral_source),
      scope_notes: normalizeOptionalString(input.scope_notes),
      color: normalizeOptionalString(input.color),
    })
    .eq('id', input.job_id);

  if (jobError) throw new Error(jobError.message);

  const { error: clientError } = await supabase
    .from('job_clients')
    .update({
      name: clientName,
      client_kind: input.client.client_kind,
      company_name: normalizeOptionalString(input.client.company_name),
      notes: normalizeOptionalString(input.client.notes),
    })
    .eq('id', input.client.id);

  if (clientError) throw new Error(clientError.message);

  const { error: deleteError } = await supabase
    .from('job_client_contacts')
    .delete()
    .eq('job_client_id', input.client.id);

  if (deleteError) throw new Error(deleteError.message);

  const cleanedContacts = input.client.contacts
    .filter((c) => c.name?.trim())
    .map((c, index) => ({
      job_client_id: input.client.id,
      name: normalizeRequiredString(c.name, 'Contact name'),
      label: normalizeOptionalString(c.label),
      email: normalizeOptionalString(c.email),
      phone: normalizeOptionalString(c.phone),
      is_primary: c.is_primary ?? index === 0,
      receives_notifications: c.receives_notifications ?? true,
    }));

  if (cleanedContacts.length === 0) {
    throw new Error('At least one contact with a name is required.');
  }

  const { error: insertError } = await supabase
    .from('job_client_contacts')
    .insert(cleanedContacts);

  if (insertError) throw new Error(insertError.message);

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${input.job_id}`);
  redirect(`/jobs/${input.job_id}`);
}