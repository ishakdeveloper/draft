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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brand_members: {
        Row: {
          brand_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_secrets: {
        Row: {
          brand_id: string
          shopify_access_token: string | null
          shopify_client_id: string | null
          shopify_client_secret: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          shopify_access_token?: string | null
          shopify_client_id?: string | null
          shopify_client_secret?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          shopify_access_token?: string | null
          shopify_client_id?: string | null
          shopify_client_secret?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_secrets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          default_locale: string
          id: string
          name: string
          shopify_domain: string
          shopify_vendor: string
          slug: string
          target_locales: string[]
          tone_guide: string
          visual_notes: string
        }
        Insert: {
          created_at?: string
          default_locale?: string
          id?: string
          name: string
          shopify_domain: string
          shopify_vendor: string
          slug: string
          target_locales?: string[]
          tone_guide: string
          visual_notes?: string
        }
        Update: {
          created_at?: string
          default_locale?: string
          id?: string
          name?: string
          shopify_domain?: string
          shopify_vendor?: string
          slug?: string
          target_locales?: string[]
          tone_guide?: string
          visual_notes?: string
        }
        Relationships: []
      }
      listing_drafts: {
        Row: {
          approved_at: string | null
          brand_id: string
          claims: Json | null
          claims_checked_at: string | null
          content: Json | null
          created_at: string
          error: Json | null
          id: string
          image_path: string | null
          image_prompt: string | null
          model: string | null
          product_id: string
          publish_hash: string | null
          published_at: string | null
          rejected_at: string | null
          review_note: string | null
          shopify_media_id: string | null
          shopify_media_path: string | null
          reviewer_id: string | null
          source_body_html: string
          source_hash: string
          source_title: string
          status: Database["public"]["Enums"]["draft_status"]
          translations: Json
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          brand_id: string
          content?: Json | null
          created_at?: string
          error?: Json | null
          id?: string
          image_path?: string | null
          image_prompt?: string | null
          model?: string | null
          product_id: string
          publish_hash?: string | null
          published_at?: string | null
          rejected_at?: string | null
          review_note?: string | null
          shopify_media_id?: string | null
          shopify_media_path?: string | null
          reviewer_id?: string | null
          source_body_html?: string
          source_hash: string
          source_title: string
          status?: Database["public"]["Enums"]["draft_status"]
          translations?: Json
          updated_at?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          brand_id?: string
          claims?: Json | null
          claims_checked_at?: string | null
          content?: Json | null
          created_at?: string
          error?: Json | null
          id?: string
          image_path?: string | null
          image_prompt?: string | null
          model?: string | null
          product_id?: string
          publish_hash?: string | null
          published_at?: string | null
          rejected_at?: string | null
          review_note?: string | null
          shopify_media_id?: string | null
          shopify_media_path?: string | null
          reviewer_id?: string | null
          source_body_html?: string
          source_hash?: string
          source_title?: string
          status?: Database["public"]["Enums"]["draft_status"]
          translations?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_drafts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_drafts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_events: {
        Row: {
          brand_id: string | null
          created_at: string
          detail: Json | null
          draft_id: string | null
          duration_ms: number | null
          id: number
          idempotency_key: string | null
          product_id: string | null
          status: string
          step: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          detail?: Json | null
          draft_id?: string | null
          duration_ms?: number | null
          id?: never
          idempotency_key?: string | null
          product_id?: string | null
          status: string
          step: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          detail?: Json | null
          draft_id?: string | null
          duration_ms?: number | null
          id?: never
          idempotency_key?: string | null
          product_id?: string | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_events_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "listing_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          body_html: string
          brand_id: string
          created_at: string
          handle: string | null
          id: string
          product_type: string | null
          raw: Json
          shopify_gid: string
          shopify_product_id: number
          shopify_updated_at: string | null
          source_hash: string
          status: string | null
          tags: string[]
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          body_html?: string
          brand_id: string
          created_at?: string
          handle?: string | null
          id?: string
          product_type?: string | null
          raw: Json
          shopify_gid: string
          shopify_product_id: number
          shopify_updated_at?: string | null
          source_hash: string
          status?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          body_html?: string
          brand_id?: string
          created_at?: string
          handle?: string | null
          id?: string
          product_type?: string | null
          raw?: Json
          shopify_gid?: string
          shopify_product_id?: number
          shopify_updated_at?: string | null
          source_hash?: string
          status?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
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
      draft_status:
        | "drafting"
        | "pending_review"
        | "approved"
        | "rejected"
        | "published"
        | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      draft_status: [
        "drafting",
        "pending_review",
        "approved",
        "rejected",
        "published",
        "failed",
      ],
    },
  },
} as const
