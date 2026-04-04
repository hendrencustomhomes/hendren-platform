'use client';

import { useMemo, useState, useTransition } from 'react';
import { createJobWithClient } from './actions';

type ContactFormRow = {
  id: string;
  name: string;
  label: string;
  email: string;
  phone: string;
  is_primary: boolean;
  receives_notifications: boolean;
};

function makeContact(overrides?: Partial<ContactFormRow>): ContactFormRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    label: '',
    email: '',
    phone: '',
    is_primary: false,
    receives_notifications: true,
    ...overrides,
  };
}

export default function JobForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [jobName, setJobName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [sqft, setSqft] = useState('');
  const [lotSqft, setLotSqft] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [scopeNotes, setScopeNotes] = useState('');
  const [color, setColor] = useState('#3B8BD4');

  const [clientName, setClientName] = useState('');
  const [clientKind, setClientKind] = useState<'individual' | 'company'>('individual');
  const [companyName, setCompanyName] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [contacts, setContacts] = useState<ContactFormRow[]>([
    makeContact({ is_primary: true }),
  ]);

  const primaryContactCount = useMemo(
    () => contacts.filter((contact) => contact.is_primary).length,
    [contacts]
  );

  function updateContact(id: string, patch: Partial<ContactFormRow>) {
    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact))
    );
  }

  function setPrimaryContact(id: string) {
    setContacts((prev) =>
      prev.map((contact) => ({
        ...contact,
        is_primary: contact.id === id,
      }))
    );
  }

  function addContact() {
    setContacts((prev) => [...prev, makeContact()]);
  }

  function removeContact(id: string) {
    setContacts((prev) => {
      const next = prev.filter((contact) => contact.id !== id);
      if (next.length === 0) return [makeContact({ is_primary: true })];
      if (!next.some((contact) => contact.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const payload = {
      job_name: jobName,
      client_name: clientName,
      project_address: projectAddress,
      sqft: sqft ? Number(sqft) : null,
      lot_sqft: lotSqft ? Number(lotSqft) : null,
      referral_source: referralSource,
      scope_notes: scopeNotes,
      color,
      client: {
        name: clientName,
        client_kind: clientKind,
        company_name: clientKind === 'company' ? companyName : '',
        notes: clientNotes,
        is_primary: true,
        contacts: contacts.map((contact) => ({
          name: contact.name,
          label: contact.label,
          email: contact.email,
          phone: contact.phone,
          is_primary: contact.is_primary,
          receives_notifications: contact.receives_notifications,
        })),
      },
    };

    startTransition(async () => {
      try {
        await createJobWithClient(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
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
              value={projectAddress}
              onChange={(e) => setProjectAddress(e.target.value)}
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
              placeholder="John & Sarah Smith"
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
            <div key={contact.id} className="rounded-lg border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium">Contact {index + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeContact(contact.id)}
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
                    onChange={(e) => updateContact(contact.id, { name: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                    required
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Label</span>
                  <input
                    value={contact.label}
                    onChange={(e) => updateContact(contact.id, { label: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="Owner, Spouse, Billing, Assistant"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Email</span>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    value={contact.phone}
                    onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="primaryContact"
                    checked={contact.is_primary}
                    onChange={() => setPrimaryContact(contact.id)}
                  />
                  <span className="text-sm">Primary contact</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contact.receives_notifications}
                    onChange={(e) =>
                      updateContact(contact.id, {
                        receives_notifications: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm">Receives notifications</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {primaryContactCount !== 1 && (
          <p className="text-sm text-amber-600">
            Exactly one contact should be marked as primary.
          </p>
        )}
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
          {isPending ? 'Creating Job...' : 'Create Job'}
        </button>
      </div>
    </form>
  );
}