// Campaign data helpers (queries + mutations).
//
// Kept in one module so the route components stay declarative. Each
// function returns plain typed rows; the routes own the React state
// and loading flow.

import { supabase, type CampaignRow, type CampaignMemberRow } from '@/lib/supabase';

export interface CampaignSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly join_code: string;
  readonly owner_id: string;
  readonly updated_at: string;
  readonly memberCount: number;
}

// Lists every campaign the signed-in user is a member of. RLS gates
// reads to membership, so this query needs no explicit user filter.
export const listMyCampaigns = async (): Promise<CampaignSummary[]> => {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, owner_id, name, description, join_code, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const campaigns = data ?? [];
  if (campaigns.length === 0) return [];

  // Member counts: one query, group client-side. Saves a row per
  // campaign vs an aggregation RPC.
  const { data: memberRows, error: mErr } = await supabase
    .from('campaign_members')
    .select('campaign_id')
    .in(
      'campaign_id',
      campaigns.map((c) => c.id),
    );
  if (mErr) throw mErr;
  const counts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
  }
  return campaigns.map((c) => ({ ...c, memberCount: counts.get(c.id) ?? 0 }));
};

export const createCampaign = async (
  name: string,
  description: string,
): Promise<CampaignRow> => {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ name, description })
    .select('*')
    .single();
  if (error) {
    // If the failure looks auth-shaped, attach the server's view of
    // the request's auth state. Helps diagnose cases where the client
    // session looks signed-in but the server is treating the request
    // as anon.
    if (looksLikeAuthFailure(error.message)) {
      const diag = await fetchAuthDiagnostic();
      if (diag) (error as { message: string }).message += ` (server saw: ${diag})`;
    }
    throw error;
  }
  return data;
};

const looksLikeAuthFailure = (msg: string | undefined): boolean => {
  if (!msg) return false;
  return /row-level security|insufficient privilege|signed in|jwt/i.test(msg);
};

const fetchAuthDiagnostic = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('debug_auth_state');
    if (error || !data) return null;
    const d = data as { uid: string | null; role: string | null; has_jwt_claims: boolean };
    return `role=${d.role ?? 'null'}, uid=${d.uid ?? 'null'}, jwt=${d.has_jwt_claims}`;
  } catch {
    return null;
  }
};

// Calls the SECURITY DEFINER `join_campaign(code)` RPC. Returns the
// joined campaign's id so the caller can route to /campaigns/:id.
export const joinCampaignByCode = async (code: string): Promise<string> => {
  const { data, error } = await supabase.rpc('join_campaign', { code });
  if (error) throw error;
  return data;
};

export const leaveCampaign = async (campaignId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const deleteCampaign = async (campaignId: string): Promise<void> => {
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) throw error;
};

export interface CampaignDetail {
  readonly campaign: CampaignRow;
  readonly members: ReadonlyArray<MemberWithUsername>;
  readonly characters: ReadonlyArray<CampaignCharacterRow>;
}

export interface MemberWithUsername extends CampaignMemberRow {
  readonly username: string | null;
}

export interface CampaignCharacterRow {
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly ownerUsername: string | null;
}

export const fetchCampaignDetail = async (
  campaignId: string,
): Promise<CampaignDetail> => {
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (cErr) throw cErr;

  const { data: members, error: mErr } = await supabase
    .from('campaign_members')
    .select('*')
    .eq('campaign_id', campaignId);
  if (mErr) throw mErr;

  const { data: characters, error: chErr } = await supabase
    .from('characters')
    .select('id, name, owner_id')
    .eq('campaign_id', campaignId)
    .order('name');
  if (chErr) throw chErr;

  // Resolve usernames for every member + character owner in one query.
  const userIds = new Set<string>();
  for (const m of members ?? []) userIds.add(m.user_id);
  for (const ch of characters ?? []) userIds.add(ch.owner_id);
  const profileMap = await fetchUsernames([...userIds]);

  return {
    campaign,
    members: (members ?? []).map((m) => ({
      ...m,
      username: profileMap.get(m.user_id) ?? null,
    })),
    characters: (characters ?? []).map((ch) => ({
      ...ch,
      ownerUsername: profileMap.get(ch.owner_id) ?? null,
    })),
  };
};

// Bulk username lookup with a small cache. The cache is process-local
// (cleared on full page reload), which is fine for this app's size.
const usernameCache = new Map<string, string>();

export const fetchUsernames = async (
  userIds: ReadonlyArray<string>,
): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  const toFetch: string[] = [];
  for (const id of userIds) {
    const cached = usernameCache.get(id);
    if (cached !== undefined) out.set(id, cached);
    else toFetch.push(id);
  }
  if (toFetch.length === 0) return out;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', toFetch);
  if (error) throw error;
  for (const row of data ?? []) {
    usernameCache.set(row.id, row.username);
    out.set(row.id, row.username);
  }
  return out;
};
