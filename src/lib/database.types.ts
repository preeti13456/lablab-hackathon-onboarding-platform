export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          created_at: string
          hackathon_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          created_at?: string
          hackathon_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          hackathon_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
      hackathons: {
        Row: {
          created_at: string
          discord_server_id: string | null
          end_date: string | null
          github_org: string | null
          id: string
          name: string
          slug: string
          start_date: string | null
          welcome_message: string | null
        }
        Insert: {
          created_at?: string
          discord_server_id?: string | null
          end_date?: string | null
          github_org?: string | null
          id?: string
          name: string
          slug: string
          start_date?: string | null
          welcome_message?: string | null
        }
        Update: {
          created_at?: string
          discord_server_id?: string | null
          end_date?: string | null
          github_org?: string | null
          id?: string
          name?: string
          slug?: string
          start_date?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      organizer_hackathons: {
        Row: {
          created_at: string
          hackathon_id: string
          id: string
          organizer_id: string
        }
        Insert: {
          created_at?: string
          hackathon_id: string
          id?: string
          organizer_id: string
        }
        Update: {
          created_at?: string
          hackathon_id?: string
          id?: string
          organizer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_hackathons_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_hackathons_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          auth_user_id: string | null
          created_at: string
          discord_username: string | null
          email: string
          github_username: string | null
          hackathon_id: string
          id: string
          name: string
          steps_completed: Json
          team_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          discord_username?: string | null
          email: string
          github_username?: string | null
          hackathon_id: string
          id?: string
          name: string
          steps_completed?: Json
          team_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          discord_username?: string | null
          email?: string
          github_username?: string | null
          hackathon_id?: string
          id?: string
          name?: string
          steps_completed?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          discord_channel_id: string | null
          github_repo_url: string | null
          hackathon_id: string
          id: string
          is_approved: boolean
          name: string
        }
        Insert: {
          created_at?: string
          discord_channel_id?: string | null
          github_repo_url?: string | null
          hackathon_id: string
          id?: string
          is_approved?: boolean
          name: string
        }
        Update: {
          created_at?: string
          discord_channel_id?: string | null
          github_repo_url?: string | null
          hackathon_id?: string
          id?: string
          is_approved?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_hackathon_id_fkey"
            columns: ["hackathon_id"]
            isOneToOne: false
            referencedRelation: "hackathons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']