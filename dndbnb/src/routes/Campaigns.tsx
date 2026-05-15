// Campaigns list page.
//
// Lists every campaign the user is a member of, with a create-form
// and a join-by-code form inline. Detail / member-roster lives at
// /campaigns/:id.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createCampaign,
  joinCampaignByCode,
  listMyCampaigns,
  type CampaignSummary,
} from '@/lib/campaigns';

export const Campaigns = (): JSX.Element => {
  const [rows, setRows] = useState<ReadonlyArray<CampaignSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    try {
      setRows(await listMyCampaigns());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (error) return <p className="status error">{error}</p>;
  if (rows === null) return <p className="status">Loading campaigns...</p>;

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>Campaigns</h2>
      </div>
      <div className="campaign-forms">
        <CreateCampaignForm onCreated={reload} />
        <JoinCampaignForm />
      </div>
      <h3 className="campaigns-list-heading">My campaigns</h3>
      {rows.length === 0 ? (
        <p className="empty">
          You haven't joined any campaigns yet. Create one above, or join with a code from a
          friend.
        </p>
      ) : (
        <ul className="campaign-list">
          {rows.map((c) => (
            <li key={c.id} className="campaign-card">
              <Link to={`/campaigns/${c.id}`}>
                <span className="campaign-name">{c.name}</span>
                <span className="campaign-meta">
                  {c.memberCount} member{c.memberCount === 1 ? '' : 's'} | Updated{' '}
                  {new Date(c.updated_at).toLocaleDateString()}
                </span>
                {c.description && (
                  <span className="campaign-desc">{c.description}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

interface CreateCampaignFormProps {
  readonly onCreated: () => void | Promise<void>;
}

const CreateCampaignForm = ({ onCreated }: CreateCampaignFormProps): JSX.Element => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const row = await createCampaign(name.trim(), description.trim());
      setName('');
      setDescription('');
      await onCreated();
      navigate(`/campaigns/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="campaign-form" onSubmit={submit}>
      <h3>Create a campaign</h3>
      <label>
        Name
        <input
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Description (optional)
        <textarea
          maxLength={500}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={pending || name.trim().length === 0}>
        {pending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
};

const JoinCampaignForm = (): JSX.Element => {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const cleaned = code.trim().toUpperCase();
      const id = await joinCampaignByCode(cleaned);
      navigate(`/campaigns/${id}`);
    } catch (err) {
      setError(humanizeJoinError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="campaign-form" onSubmit={submit}>
      <h3>Join with a code</h3>
      <label>
        Join code
        <input
          type="text"
          required
          minLength={8}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD1234"
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={pending || code.trim().length !== 8}>
        {pending ? 'Joining...' : 'Join'}
      </button>
    </form>
  );
};

const humanizeJoinError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err);
  if (/no campaign with that join code/i.test(raw)) return 'No campaign with that code.';
  return raw;
};
