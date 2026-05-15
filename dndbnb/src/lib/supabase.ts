// Supabase browser client.
//
// Configured via Vite env vars: VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY (see dndbnb/.env.local.example). The anon
// key is safe to ship in the client bundle; row-level security
// policies on the database enforce per-user access.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy dndbnb/.env.local.example to ' +
      'dndbnb/.env.local and fill in VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY from your Supabase project settings.',
  );
}

export type Database = {
  public: {
    Tables: {
      characters: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          is_public: boolean;
          payload: unknown;
          schema_version: number;
          campaign_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_public?: boolean;
          payload: unknown;
          schema_version: number;
          campaign_id?: string | null;
        };
        Update: {
          name?: string;
          is_public?: boolean;
          payload?: unknown;
          schema_version?: number;
          campaign_id?: string | null;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          user_id: string;
          character_id: string;
          created_at: string;
        };
        Insert: {
          character_id: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
        };
        Update: {
          username?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          join_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string;
        };
        Update: {
          name?: string;
          description?: string;
        };
        Relationships: [];
      };
      campaign_members: {
        Row: {
          campaign_id: string;
          user_id: string;
          role: 'owner' | 'player';
          joined_at: string;
        };
        Insert: {
          campaign_id: string;
          role?: 'owner' | 'player';
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_campaign: {
        Args: { code: string };
        Returns: string;
      };
      debug_auth_state: {
        Args: Record<string, never>;
        Returns: { uid: string | null; role: string | null; has_jwt_claims: boolean };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type CharacterRow = Database['public']['Tables']['characters']['Row'];
export type FavoriteRow = Database['public']['Tables']['favorites']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
export type CampaignMemberRow = Database['public']['Tables']['campaign_members']['Row'];

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
