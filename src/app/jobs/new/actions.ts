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

type CreateJobInput = {
  job_name: string;
  client_name?: string;
  project_address: string;
  sqft?: number | null;
  lot_sqft?: number | null;
  referral_source?: string;
  scope_notes?: string;
  color?: string;
  client: {
    name: string;
    client_kind: 'individual' | 'company';
    company_name?: string;
    notes?: string;
    is_primary?: boolean;
    contacts: ContactInput[];
  };
};

function normalizeOptionalString(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredString(value: string | null | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function normalizeOptionalNumber(value?: number | null): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function validatePayload(input: CreateJobInput) {
  normalizeRequiredString(input.job_name, 'Job name');
  normalizeRequiredString(input.project_address, 'Project address');
  normalizeRequiredString(input.client?.name, 'Client name');

  if (!['individual', 'company'].includes(input.client.client_kind)) {
    throw new Error('Client type is invalid.');
  }

  if (!Array.isArray(input.client.contacts) || input.client.contacts.length === 0) {
    throw new Error('At least one client contact is required.');
  }

  const validContacts = input.client.contacts.filter((contact) => {
    return contact.name?.trim() || contact.email?.trim() || contact.phone?.trim();
  });

  if (validContacts.length === 0) {
    throw new Error('At least one valid client contact is required.');
  }

  const contactsMissingNames = validContacts.some((contact) => !contact.name?.trim());
  if (contactsMissingNames) {
    throw new Error('Each client contact must include a name.');
  }
}

export async function createJobWithClient(input: CreateJobInput) {
  validatePayload(input);

  const supabase = await createClient();

  const jobInsert = {
    job_name: normalizeRequiredString(input.job_name, 'Job name'),
    client_name: normalizeRequiredString(input.client_name ?? input.client.name, 'Client name'),
    project_address: normalizeRequiredString(input.project_address, 'Project address'),
    sqft: normalizeOptionalNumber(input.sqft),
    lot_sqft: normalizeOptionalNumber(input.lot_sqft),
    referral_source: normalizeOptionalString(input.referral_source),
    scope_notes: normalizeOptionalString(input.scope_notes),
    color: normalizeOptionalString(input.color),
  };

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert(jobInsert)
    .select('id')
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message || 'Failed to create job.');
  }

  const { data: jobClient, error: jobClientError } = await supabase
    .from('job_clients')
    .insert({
      job_id: job.id,
      name: normalizeRequiredString(input.client.name, 'Client name'),
      client_kind: input.client.client_kind,
      company_name: normalizeOptionalString(input.client.company_name),
      is_primary: input.client.is_primary ?? true,
      notes: normalizeOptionalString(input.client.notes),
    })
    .select('id')
    .single();

  if (jobClientError || !jobClient) {
    throw new Error(jobClientError?.message || 'Failed to create job client.');
  }

  const cleanedContacts = input.client.contacts
    .filter((contact) => contact.name?.trim() || contact.email?.trim() || contact.phone?.trim())
    .map((contact, index) => ({
      job_client_id: jobClient.id,
      name: normalizeRequiredString(contact.name, 'Client contact name'),
      label: normalizeOptionalString(contact.label),
      email: normalizeOptionalString(contact.email),
      phone: normalizeOptionalString(contact.phone),
      is_primary: contact.is_primary ?? index === 0,
      receives_notifications: contact.receives_notifications ?? true,
    }));

  const { error: contactError } = await supabase
    .from('job_client_contacts')
    .insert(cleanedContacts);

  if (contactError) {
    throw new Error(contactError.message || 'Failed to create client contacts.');
  }

  revalidatePath('/');
  revalidatePath('/jobs');
  redirect(`/jobs/${job.id}`);
}