export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agreement_versions: {
        Row: {
          content: string
          created_at: string
          effective_date: string
          id: string
          type: string
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          effective_date?: string
          id?: string
          type: string
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          effective_date?: string
          id?: string
          type?: string
          version?: string
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          context_data: Json | null
          created_at: string
          id: string
          message: string
          response: string
          user_id: string
        }
        Insert: {
          context_data?: Json | null
          created_at?: string
          id?: string
          message: string
          response: string
          user_id: string
        }
        Update: {
          context_data?: Json | null
          created_at?: string
          id?: string
          message?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_data: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string | null
          date: string | null
          description: string | null
          id: string
          label: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          currency?: string | null
          date?: string | null
          description?: string | null
          id?: string
          label: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string | null
          date?: string | null
          description?: string | null
          id?: string
          label?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          occurred_at: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          occurred_at?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          occurred_at?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          progress: number
          status: string
          target_amount: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          progress?: number
          status?: string
          target_amount: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          progress?: number
          status?: string
          target_amount?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_vault: {
        Row: {
          content: string
          created_at: string
          id: string
          tags: string[]
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string | null
          mood_label: string | null
          mood_score: number
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string | null
          mood_label?: string | null
          mood_score: number
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string | null
          mood_label?: string | null
          mood_score?: number
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      news_cache: {
        Row: {
          content: string | null
          created_at: string
          fetched_at: string
          id: string
          published_at: string
          sentiment: number | null
          source: string
          symbol: string
          title: string
          url: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          fetched_at?: string
          id?: string
          published_at: string
          sentiment?: number | null
          source: string
          symbol: string
          title: string
          url: string
        }
        Update: {
          content?: string | null
          created_at?: string
          fetched_at?: string
          id?: string
          published_at?: string
          sentiment?: number | null
          source?: string
          symbol?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          address: string | null
          asset_type: string | null
          avg_price: number
          created_at: string
          currency: string
          current_price: number | null
          id: string
          is_crypto: boolean | null
          last_updated: string | null
          market: string
          property_type: string | null
          purchase_price: number | null
          quantity: number
          sqft: number | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          asset_type?: string | null
          avg_price: number
          created_at?: string
          currency: string
          current_price?: number | null
          id?: string
          is_crypto?: boolean | null
          last_updated?: string | null
          market: string
          property_type?: string | null
          purchase_price?: number | null
          quantity: number
          sqft?: number | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          asset_type?: string | null
          avg_price?: number
          created_at?: string
          currency?: string
          current_price?: number | null
          id?: string
          is_crypto?: boolean | null
          last_updated?: string | null
          market?: string
          property_type?: string | null
          purchase_price?: number | null
          quantity?: number
          sqft?: number | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          asset_type: string
          currency: string
          id: string
          price: number
          symbol: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          asset_type: string
          currency?: string
          id?: string
          price: number
          symbol: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          asset_type?: string
          currency?: string
          id?: string
          price?: number
          symbol?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string | null
          created_at: string
          display_name: string | null
          id: string
          income: number | null
          interests: string[] | null
          risk_profile: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          income?: number | null
          interests?: string[] | null
          risk_profile?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          income?: number | null
          interests?: string[] | null
          risk_profile?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_contributions: {
        Row: {
          amount_sar: number
          created_at: string
          financial_entry_id: string | null
          goal_id: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount_sar: number
          created_at?: string
          financial_entry_id?: string | null
          goal_id?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount_sar?: number
          created_at?: string
          financial_entry_id?: string | null
          goal_id?: string | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_contributions_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          reminder_at: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          reminder_at?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          reminder_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_agreements: {
        Row: {
          accepted_at: string
          agreement_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          agreement_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          agreement_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_portfolio_summary: {
        Args: { user_uuid: string }
        Returns: {
          asset_allocation: Json
          total_cost: number
          total_pnl: number
          total_pnl_percent: number
          total_value: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_portfolio_buy_with_wallet: {
        Args: {
          _currency?: string
          _price: number
          _quantity: number
          _symbol: string
          _user_id: string
        }
        Returns: {
          holding_id: string
          new_balance: number
        }[]
      }
      record_savings_contribution: {
        Args: {
          _amount_sar: number
          _goal_id?: string
          _note?: string
          _user_id: string
        }
        Returns: {
          contribution_id: string
          financial_entry_id: string
          new_balance: number
        }[]
      }
      reset_dev_data_seed: {
        Args: { _seed: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
