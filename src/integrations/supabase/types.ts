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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      brand_catalog: {
        Row: {
          available_sizes: string[]
          brand_key: string
          created_at: string
          display_name: string
          domains: string[] | null
          fit_tendency: string | null
          garment_categories: string[] | null
          id: string
          size_scale: string
          updated_at: string
        }
        Insert: {
          available_sizes?: string[]
          brand_key: string
          created_at?: string
          display_name: string
          domains?: string[] | null
          fit_tendency?: string | null
          garment_categories?: string[] | null
          id?: string
          size_scale?: string
          updated_at?: string
        }
        Update: {
          available_sizes?: string[]
          brand_key?: string
          created_at?: string
          display_name?: string
          domains?: string[] | null
          fit_tendency?: string | null
          garment_categories?: string[] | null
          id?: string
          size_scale?: string
          updated_at?: string
        }
        Relationships: []
      }
      low_confidence_logs: {
        Row: {
          anchor_brand: string
          anchor_size: string
          category: string
          confidence: number
          coverage: number
          created_at: string
          id: string
          reason: string
          target_brand: string
        }
        Insert: {
          anchor_brand: string
          anchor_size: string
          category: string
          confidence: number
          coverage: number
          created_at?: string
          id?: string
          reason: string
          target_brand: string
        }
        Update: {
          anchor_brand?: string
          anchor_size?: string
          category?: string
          confidence?: number
          coverage?: number
          created_at?: string
          id?: string
          reason?: string
          target_brand?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anchor_brands: Json | null
          created_at: string
          display_name: string | null
          fit_preference: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_brands?: Json | null
          created_at?: string
          display_name?: string | null
          fit_preference?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_brands?: Json | null
          created_at?: string
          display_name?: string | null
          fit_preference?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          brand_key: string
          created_at: string
          explanation_bullets: Json | null
          id: string
          product_url: string | null
          recommended_size: string
          user_id: string
        }
        Insert: {
          brand_key: string
          created_at?: string
          explanation_bullets?: Json | null
          id?: string
          product_url?: string | null
          recommended_size: string
          user_id: string
        }
        Update: {
          brand_key?: string
          created_at?: string
          explanation_bullets?: Json | null
          id?: string
          product_url?: string | null
          recommended_size?: string
          user_id?: string
        }
        Relationships: []
      }
      sizing_charts: {
        Row: {
          airtable_record_id: string | null
          brand_key: string
          category: string
          created_at: string
          fit_notes: string | null
          id: string
          measurements: Json | null
          raw_measurements: Json | null
          size_label: string
          synced_at: string | null
        }
        Insert: {
          airtable_record_id?: string | null
          brand_key: string
          category: string
          created_at?: string
          fit_notes?: string | null
          id?: string
          measurements?: Json | null
          raw_measurements?: Json | null
          size_label: string
          synced_at?: string | null
        }
        Update: {
          airtable_record_id?: string | null
          brand_key?: string
          category?: string
          created_at?: string
          fit_notes?: string | null
          id?: string
          measurements?: Json | null
          raw_measurements?: Json | null
          size_label?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sizing_charts_brand_key_fkey"
            columns: ["brand_key"]
            isOneToOne: false
            referencedRelation: "brand_catalog"
            referencedColumns: ["brand_key"]
          },
        ]
      }
      user_adjustments: {
        Row: {
          action: string
          created_at: string
          final_size: string
          id: string
          recommendation_id: string
        }
        Insert: {
          action: string
          created_at?: string
          final_size: string
          id?: string
          recommendation_id: string
        }
        Update: {
          action?: string
          created_at?: string
          final_size?: string
          id?: string
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_adjustments_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
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
    Enums: {},
  },
} as const
