'use client';

import { useState, useTransition } from 'react';
import { updateJobWithClient } from './actions';

type ContactRow = {
  name: string;
  label: string;
  email: string;
  phone: string;
  is_primary: boolean;
  receives_notifications: boolean;
};

type JobEditFormProps = {
  job: {
    id: string;
    job_name: string | null;
    project_address: string;
    sqft: number | null;
    lot_sqft: number | null;
    referral_source: string | null;
    scope_notes: string | null;
    color: string;
  };
  client: {
    id: string;
    name: string;
    client_kind: 'individual' | 'company';
    company_name: string | null;
    notes: string | null;
    job_client_contacts: ContactRow[];
  };
};

function blankContact(): ContactRow {
  return {
    name: '',
    label: '',
    email: '',
    phone: '',
    is_primary: false,
    receives_notifications: true,
  };
}

export default function JobEditForm({ job, client }: JobEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [jobName, setJobName] = useState(job.job_name ?? '');
  const [address, setAddress] = useState(job.project_address ?? '');
  const [sqft, setSqft] = useState(job.sqft?.toString() ?? '');
  const [lotSqft, setLotSqft] = useState(job.lot_sqft?.toString() ?? '');
  const [referralSource, setReferralSource] = useState(job.referral_source ?? '');
  const [scopeNotes, setScopeNotes] = useState(job.scope_notes ?? '');
  const [color, setColor] = useState(job.color ?? '#3B8BD4');

  const [clientName, setClientName] = useState(client.name ?? '');
  const [clientKind, setClientKind] = useState<'individual' | 'company'>(client.client_kind ?? 'individual');
  const [companyName, setCompanyName] = useState(client.company_name ?? '');
  const [clientNotes, setClientNotes] = useState(client.notes ?? '');

  const [contacts, setContacts] = useState<ContactRow[]>(
    client.job_client_contacts.length > 0
      ? client.job_client_contacts.map((c) => ({
          name: c.name ?? '',
          label: c.label ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          is_primary: c.is_primary ?? false,
          receives_notifications: c.receives_notifications ?? true,
        }))
      : [{ ...blankContact(), is_primary: true }]
  );

  function updateContact(index: number, patch: Partial<ContactRow>) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  }

  function setPrimary(index: number) {
    setContacts((prev) =>
      prev.map((c, i) => ({ ...c, is_primary: i === index }))
    );
  }

  function addContact() {
    setContacts((prev) => [...prev, blankContact()]);
  }

  function removeContact(index: number) {
    setContacts((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) return [{ ...blankContact(), is_primary: true }];
      if (!next.some((c) => c.is_primary)) next[0] = { ...next[0], is_primary: true };
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await updateJobWithClient({
          job_id: job.id,
          job_name: jobName,
          project_address: address,
          sqft: sqft ? Number(sqft) : null,
          lot_sqft: lotSqft ? Number(lotSqft) : null,
          referral_source: referralSource,
          scope_notes: scopeNotes,
          color,
          client: {
            id: client.id,
            name: clientName,
            client_kind: clientKind,
            company_name: clientKind === 'company' ? companyName : '',
            notes: clientNotes,
            contacts,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Job Details</h2>
        <div className="grid gap-4 md:grid-cols-2">

          <label className="space-y-1">
            <span className="text-sm font-medium">Job Name</span>
            <input
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Project Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Square Feet</span>
            <input
              type="number"
              min="0"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Lot Square Feet</span>
            <input
              type="number"
              min="0"
              value={lotSqft}
              onChange={(e) => setLotSqft(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Referral Source</span>
            <input
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Job Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-full rounded-md border px-2 py-1"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Scope Notes</span>
            <textarea
              value={scopeNotes}
              onChange={(e) => setScopeNotes(e.target.value)}
              className="min-h-[120px] w-full rounded-md border px-3 py-2"
            />
          </label>

        </div>
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="text-lg font-semibold">Client</h2>
        <div className="grid gap-4 md:grid-cols-2">

          <label className="space-y-1">
            <span className="text-sm font-medium">Client Name</span>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Client Type</span>
            <select
              value={clientKind}
              onChange={(e) => setClientKind(e.target.value as 'individual' | 'company')}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </label>

          {clientKind === 'company' && (
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Company Legal Name</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              />
            </label>
          )}

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">Client Notes</span>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              className="min-h-[100px] w-full rounded-md border px-3 py-2"
            />
          </label>

        </div>
      </section>

      <section className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Client Contacts</h2>
          <button
            type="button"
            onClick={addContact}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Add Contact
          </button>
        </div>

        <div className="space-y-4">
          {contacts.map((contact, index) => (
            <div key={index} className="rounded-lg border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium">Contact {index + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeContact(index)}
                  className="text-sm text-red-600"
                  disabled={contacts.length === 1}
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={contact.name}
                    onChange={(e) => updateContact(index, { name: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                    required
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Label</span>
                  <input
                    value={contact.label}
                    onChange={(e) => updateContact(index, { label: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="Owner, Spouse, Billing"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Email</span>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(index, { email: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    value={contact.phone}
                    onChange={(e) => updateContact(index, { phone: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="primaryContact"
                    checked={contact.is_primary}
                    onChange={() => setPrimary(index)}
                  />
                  <span className="text-sm">Primary contact</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contact.receives_notifications}
                    onChange={(e) =>
                      updateContact(index, { receives_notifications: e.target.checked })
                    }
                  />
                  <span className="text-sm">Receives notifications</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

    </form>
  );
}
