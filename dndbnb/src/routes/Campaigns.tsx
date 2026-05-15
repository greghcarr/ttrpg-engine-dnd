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
import { errorMessage } from '@/lib/errors';
import {
  CAMPAIGN_ICON_IDS,
  CampaignIcon,
  DEFAULT_CAMPAIGN_ICON,
} from '@/components/CampaignIcons';
import { KeyIcon, PlusIcon } from '@/components/Icons';

export const Campaigns = (): JSX.Element => {
  const [rows, setRows] = useState<ReadonlyArray<CampaignSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    try {
      setRows(await listMyCampaigns());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>My campaigns</h2>
      </div>
      {error ? (
        <p className="status error">{error}</p>
      ) : rows === null ? (
        <p className="status">Loading campaigns...</p>
      ) : rows.length === 0 ? (
        <p className="empty">
          You haven't joined any campaigns yet. Join one with a code, or create one of your own
          below.
        </p>
      ) : (
        <ul className="campaign-list">
          {rows.map((c) => (
            <li key={c.id} className="campaign-card">
              <Link to={`/campaigns/${c.id}`}>
                <div className="campaign-card-row">
                  <CampaignIcon id={c.icon} size={28} className="campaign-card-icon" />
                  <div className="campaign-card-text">
                    <span className="campaign-name">{c.name}</span>
                    <span className="campaign-meta">
                      {c.memberCount} member{c.memberCount === 1 ? '' : 's'} | Updated{' '}
                      {new Date(c.updated_at).toLocaleDateString()}
                    </span>
                    {c.description && (
                      <span className="campaign-desc">{c.description}</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="collapsibles-row">
        <details className="collapsible">
          <summary>
            <span className="summary-icon">
              <PlusIcon />
            </span>
            Create a campaign
          </summary>
          <div className="collapsible-body">
            <CreateCampaignForm onCreated={reload} />
          </div>
        </details>

        <details className="collapsible">
          <summary>
            <span className="summary-icon">
              <KeyIcon />
            </span>
            Join a campaign
          </summary>
          <div className="collapsible-body">
            <JoinCampaignForm />
          </div>
        </details>
      </div>
    </section>
  );
};

interface CreateCampaignFormProps {
  readonly onCreated: () => void | Promise<void>;
}

const CreateCampaignForm = ({ onCreated }: CreateCampaignFormProps): JSX.Element => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_CAMPAIGN_ICON);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const row = await createCampaign(name.trim(), description.trim(), icon);
      setName('');
      setDescription('');
      setIcon(DEFAULT_CAMPAIGN_ICON);
      await onCreated();
      navigate(`/campaigns/${row.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="campaign-form" onSubmit={submit}>
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
      <fieldset className="icon-picker-fieldset">
        <legend>Icon</legend>
        <div className="icon-picker">
          {CAMPAIGN_ICON_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`icon-pick ${id === icon ? 'is-selected' : ''}`}
              onClick={() => setIcon(id)}
              aria-label={id}
              title={id}
              aria-pressed={id === icon}
            >
              <CampaignIcon id={id} size={22} />
            </button>
          ))}
        </div>
      </fieldset>
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
  const raw = errorMessage(err);
  if (/no campaign with that join code/i.test(raw)) return 'No campaign with that code.';
  return raw;
};
