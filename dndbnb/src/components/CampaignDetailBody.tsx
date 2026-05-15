// Shared campaign-detail body. Renders the join code (owners only),
// member roster, attached characters, and the leave / delete actions.
// Used both by the standalone /campaigns/:id route and by the
// inline-expansion <details> cards on /campaigns. Icon-picker and
// rename live in <CampaignIconButton> / <CampaignNameEditor> next to
// the title, not in here.

import { useEffect, useState } from 'react';
import {
  deleteCampaign,
  fetchCampaignDetail,
  leaveCampaign,
  type CampaignDetail as CampaignDetailModel,
} from '@/lib/campaigns';
import { useUser } from '@/lib/session';
import { errorMessage } from '@/lib/errors';
import { CheckIcon, CopyIcon } from '@/components/Icons';
import { CharacterCard } from '@/components/CharacterCard';
import { Pagination, usePageSize } from '@/components/Pagination';

interface Props {
  readonly campaignId: string;
  /** Called after a successful leave or delete. */
  readonly onDestroyed?: () => void | Promise<void>;
}

export const CampaignDetailBody = ({ campaignId, onDestroyed }: Props): JSX.Element => {
  const user = useUser();
  const [detail, setDetail] = useState<CampaignDetailModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [charPage, setCharPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCampaignDetail(campaignId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (!detail || !user) {
    return error ? (
      <p className="status error">{error}</p>
    ) : (
      <p className="status">Loading campaign...</p>
    );
  }

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
      await onDestroyed?.();
    } catch (err) {
      setError(errorMessage(err));
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
      await onDestroyed?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="campaign-detail">
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
          <>
          <ul className="character-list">
            {detail.characters.slice(charPage * pageSize, charPage * pageSize + pageSize).map((ch) => (
              <CharacterCard
                key={ch.id}
                character={{
                  id: ch.id,
                  name: ch.name,
                  updated_at: ch.updated_at,
                  is_public: ch.is_public,
                  ownerLabel: ch.ownerUsername ?? ch.owner_id.slice(0, 8),
                  primary_class_id: ch.primary_class_id,
                  species_id: ch.species_id,
                }}
              />
            ))}
          </ul>
          <Pagination
            page={charPage}
            hasMore={detail.characters.length > (charPage + 1) * pageSize}
            onPageChange={setCharPage}
            pageSize={pageSize}
            onPageSizeChange={(next: number) => {
              setPageSize(next);
              setCharPage(0);
            }}
          />
          </>
        )}
      </section>

      {isOwner && (
        <section className="join-code-card">
          <h3>Invite code</h3>
          <div className="join-code-row">
            <code className="join-code">{detail.campaign.join_code}</code>
            <button
              type="button"
              className="icon-btn"
              onClick={onCopyCode}
              title={codeCopied ? 'Copied' : 'Copy join code'}
              aria-label={codeCopied ? 'Copied' : 'Copy join code'}
            >
              {codeCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          <p className="step-help">Share this with your players.</p>
          <p className="step-help">They enter it under Campaigns -&gt; Join with a code.</p>
        </section>
      )}

      {error && <p className="form-error">{error}</p>}

      {(isOwner || canLeave) && (
        <section className="campaign-destructive">
          {isOwner && (
            <button type="button" className="danger-button" onClick={onDelete} disabled={acting}>
              Delete this campaign
            </button>
          )}
          {canLeave && (
            <button type="button" className="danger-button" onClick={onLeave} disabled={acting}>
              Leave this campaign
            </button>
          )}
        </section>
      )}
    </div>
  );
};
