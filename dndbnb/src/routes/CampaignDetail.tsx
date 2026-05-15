// Campaign detail route. Thin wrapper around <CampaignDetailBody> with
// a breadcrumb back to the list and a redirect after the campaign is
// left or deleted.
//
// The primary UX is inline expansion on /campaigns, so this route is
// mainly a stable URL for direct links and post-create / post-join
// navigation paths.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '@/components/BackLink';
import { fetchCampaignDetail, type CampaignDetail as CampaignDetailModel } from '@/lib/campaigns';
import { errorMessage } from '@/lib/errors';
import { useUser } from '@/lib/session';
import { CampaignDetailBody } from '@/components/CampaignDetailBody';
import {
  CampaignIconButton,
  CampaignNameEditor,
} from '@/components/CampaignTitleControls';

export const CampaignDetail = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const navigate = useNavigate();
  const [head, setHead] = useState<CampaignDetailModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadHead = useCallback(async (): Promise<void> => {
    if (!id) return;
    try {
      setHead(await fetchCampaignDetail(id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchCampaignDetail(id)
      .then((d) => {
        if (!cancelled) setHead(d);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return <></>;

  const isOwner = !!head && !!user && head.campaign.owner_id === user.id;

  return (
    <section className="campaign-detail">
      <p className="breadcrumb">
        <BackLink fallback="/campaigns">&larr; Back</BackLink>
      </p>
      {head && (
        <div className="campaign-title-row">
          <CampaignIconButton
            campaignId={head.campaign.id}
            icon={head.campaign.icon}
            isOwner={isOwner}
            size={36}
            className="campaign-detail-icon"
            onChanged={reloadHead}
          />
          <CampaignNameEditor
            campaignId={head.campaign.id}
            name={head.campaign.name}
            isOwner={isOwner}
            as="h2"
            onChanged={reloadHead}
          />
        </div>
      )}
      {head?.campaign.description && (
        <p className="campaign-desc">{head.campaign.description}</p>
      )}
      {error && !head ? (
        <p className="status error">{error}</p>
      ) : (
        <CampaignDetailBody campaignId={id} onDestroyed={() => navigate('/campaigns')} />
      )}
    </section>
  );
};
