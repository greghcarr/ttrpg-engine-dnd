// Campaign detail page.
//
// Shows the join code (owners only), the member roster with
// usernames, and the list of characters currently attached to the
// campaign. Owners can delete the campaign; players can leave it.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteCampaign,
  fetchCampaignDetail,
  leaveCampaign,
  type CampaignDetail as CampaignDetailModel,
} from '@/lib/campaigns';
import { useUser } from '@/lib/session';

export const CampaignDetail = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CampaignDetailModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchCampaignDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="status error">{error}</p>;
  if (!detail || !user) return <p className="status">Loading campaign...</p>;

  const isOwner = detail.campaign.owner_id === user.id;
  const myMembership = detail.members.find((m) => m.user_id === user.id);
  const canLeave = !!myMembership && !isOwner;

  const onCopyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(detail.campaign.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // ignore: copying isn't critical
    }
  };

  const onLeave = async (): Promise<void> => {
    if (!confirm('Leave this campaign? You can rejoin with the code.')) return;
    setActing(true);
    setError(null);
    try {
      await leaveCampaign(detail.campaign.id, user.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const onDelete = async (): Promise<void> => {
    if (
      !confirm(
        `Delete "${detail.campaign.name}"? This removes the campaign for every member and detaches all attached characters. Characters themselves are not deleted.`,
      )
    )
      return;
    setActing(true);
    setError(null);
    try {
      await deleteCampaign(detail.campaign.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  return (
    <section className="campaign-detail">
      <p className="breadcrumb">
        <Link to="/campaigns">&larr; All campaigns</Link>
      </p>
      <header className="campaign-header">
        <div>
          <h2>{detail.campaign.name}</h2>
          {detail.campaign.description && (
            <p className="campaign-desc">{detail.campaign.description}</p>
          )}
        </div>
        <div className="campaign-actions">
          {isOwner && (
            <button type="button" className="ghost danger" onClick={onDelete} disabled={acting}>
              Delete campaign
            </button>
          )}
          {canLeave && (
            <button type="button" className="ghost" onClick={onLeave} disabled={acting}>
              Leave campaign
            </button>
          )}
        </div>
      </header>

      {isOwner && (
        <section className="join-code-card">
          <h3>Invite code</h3>
          <p className="step-help">Share this with your players. They enter it under Campaigns -&gt; Join with a code.</p>
          <div className="join-code-row">
            <code className="join-code">{detail.campaign.join_code}</code>
            <button type="button" className="ghost" onClick={onCopyCode}>
              {codeCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>
      )}

      <section className="campaign-section">
        <h3>Members ({detail.members.length})</h3>
        <ul className="roster">
          {detail.members.map((m) => (
            <li key={m.user_id} className="roster-row">
              <span className="roster-name">{m.username ?? m.user_id.slice(0, 8)}</span>
              <span className={`badge ${m.role === 'owner' ? 'badge-public' : 'badge-private'}`}>
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="campaign-section">
        <h3>Characters in this campaign ({detail.characters.length})</h3>
        {detail.characters.length === 0 ? (
          <p className="empty">
            No characters attached yet. Open one of your characters and attach it from the sheet.
          </p>
        ) : (
          <ul className="character-list">
            {detail.characters.map((ch) => (
              <li key={ch.id} className="character-card">
                <Link to={`/characters/${ch.id}`}>
                  <div className="character-card-head">
                    <span className="character-name">{ch.name}</span>
                  </div>
                  <div className="character-meta">
                    <span className="owner-label">
                      by {ch.ownerUsername ?? ch.owner_id.slice(0, 8)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};
