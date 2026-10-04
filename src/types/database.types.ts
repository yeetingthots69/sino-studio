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
      tracker_adjustment_batches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id: string
          project_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_adjustment_batches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_audit_log: {
        Row: {
          action: string
          actor: string | null
          at: string
          id: number
          new: Json | null
          old: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          id?: never
          new?: Json | null
          old?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          id?: never
          new?: Json | null
          old?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      tracker_cuts: {
        Row: {
          budget: number
          code: string
          created_at: string
          id: string
          links: Json
          pay_split: Json | null
          project_id: string
          updated_at: string
        }
        Insert: {
          budget?: number
          code: string
          created_at?: string
          id?: string
          links?: Json
          pay_split?: Json | null
          project_id: string
          updated_at?: string
        }
        Update: {
          budget?: number
          code?: string
          created_at?: string
          id?: string
          links?: Json
          pay_split?: Json | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_cuts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_email_log: {
        Row: {
          attempts: number
          claim_token: string | null
          claimed_until: string | null
          created_at: string
          created_by: string | null
          cut_id: string | null
          error: string | null
          id: string
          idempotency_key: string
          kind: string
          payload: Json
          ref_date: string | null
          resend_id: string | null
          staff_id: string | null
          status: string
          subject: string
          task_id: string | null
          to_email: string
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          claimed_until?: string | null
          created_at?: string
          created_by?: string | null
          cut_id?: string | null
          error?: string | null
          id?: string
          idempotency_key: string
          kind: string
          payload: Json
          ref_date?: string | null
          resend_id?: string | null
          staff_id?: string | null
          status: string
          subject: string
          task_id?: string | null
          to_email: string
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          claimed_until?: string | null
          created_at?: string
          created_by?: string | null
          cut_id?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          payload?: Json
          ref_date?: string | null
          resend_id?: string | null
          staff_id?: string | null
          status?: string
          subject?: string
          task_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_email_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "tracker_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_notice_queue: {
        Row: {
          claimed_until: string | null
          cycle_id: string
          due_at: string
          first_change_at: string
          generation: number
          removed: Json
          staff_id: string
          task_ids: string[]
        }
        Insert: {
          claimed_until?: string | null
          cycle_id?: string
          due_at: string
          first_change_at?: string
          generation?: number
          removed?: Json
          staff_id: string
          task_ids?: string[]
        }
        Update: {
          claimed_until?: string | null
          cycle_id?: string
          due_at?: string
          first_change_at?: string
          generation?: number
          removed?: Json
          staff_id?: string
          task_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "tracker_notice_queue_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "tracker_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_pay_adjustments: {
        Row: {
          amount: number
          batch_id: string
          created_at: string
          created_by: string
          cut_id: string
          id: string
          project_id: string
          reason: string
          reverses_id: string | null
          staff_id: string
          work_type_id: string
        }
        Insert: {
          amount: number
          batch_id: string
          created_at?: string
          created_by: string
          cut_id: string
          id?: string
          project_id: string
          reason: string
          reverses_id?: string | null
          staff_id: string
          work_type_id: string
        }
        Update: {
          amount?: number
          batch_id?: string
          created_at?: string
          created_by?: string
          cut_id?: string
          id?: string
          project_id?: string
          reason?: string
          reverses_id?: string | null
          staff_id?: string
          work_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_pay_adjustments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "tracker_adjustment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_pay_adjustments_cut_id_project_id_fkey"
            columns: ["cut_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tracker_cuts"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tracker_pay_adjustments_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "tracker_pay_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_pay_adjustments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "tracker_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_pay_adjustments_work_type_id_project_id_fkey"
            columns: ["work_type_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tracker_work_types"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      tracker_pay_presets: {
        Row: {
          codes: string[]
          created_at: string
          id: string
          name: string
          pcts: number[]
        }
        Insert: {
          codes: string[]
          created_at?: string
          id?: string
          name: string
          pcts: number[]
        }
        Update: {
          codes?: string[]
          created_at?: string
          id?: string
          name?: string
          pcts?: number[]
        }
        Relationships: []
      }
      tracker_projects: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          id: string
          links: Json
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          id?: string
          links?: Json
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          id?: string
          links?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracker_shares: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string | null
          project_id: string
          revoked_at: string | null
          staff_ids: string[]
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          project_id: string
          revoked_at?: string | null
          staff_ids: string[]
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
          project_id?: string
          revoked_at?: string | null
          staff_ids?: string[]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_staff: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      tracker_staff_strengths: {
        Row: {
          staff_id: string
          strength_id: string
        }
        Insert: {
          staff_id: string
          strength_id: string
        }
        Update: {
          staff_id?: string
          strength_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_staff_strengths_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "tracker_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_staff_strengths_strength_id_fkey"
            columns: ["strength_id"]
            isOneToOne: false
            referencedRelation: "tracker_strengths"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_strengths: {
        Row: {
          all_rounder: boolean
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          all_rounder?: boolean
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          all_rounder?: boolean
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      tracker_tasks: {
        Row: {
          created_at: string
          cut_id: string
          end_date: string
          id: string
          is_fix: boolean
          links: Json
          progress: number
          project_id: string
          staff_id: string
          start_date: string
          updated_at: string
          version: number
          work_type_id: string
        }
        Insert: {
          created_at?: string
          cut_id: string
          end_date: string
          id?: string
          is_fix?: boolean
          links?: Json
          progress?: number
          project_id: string
          staff_id: string
          start_date: string
          updated_at?: string
          version?: number
          work_type_id: string
        }
        Update: {
          created_at?: string
          cut_id?: string
          end_date?: string
          id?: string
          is_fix?: boolean
          links?: Json
          progress?: number
          project_id?: string
          staff_id?: string
          start_date?: string
          updated_at?: string
          version?: number
          work_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_tasks_cut_fk"
            columns: ["cut_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tracker_cuts"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tracker_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_tasks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "tracker_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_tasks_type_fk"
            columns: ["work_type_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tracker_work_types"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      tracker_users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          role: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          role?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          role?: string
        }
        Relationships: []
      }
      tracker_work_types: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          label: string
          overlaps_prev: boolean
          pay_pct: number
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color: string
          created_at?: string
          id?: string
          label: string
          overlaps_prev?: boolean
          pay_pct?: number
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          label?: string
          overlaps_prev?: boolean
          pay_pct?: number
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_work_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_tracker_user: { Args: never; Returns: boolean }
      tracker_add_adjustments: {
        Args: {
          p_batch: string
          p_entries: Json
          p_project: string
          p_reason: string
        }
        Returns: {
          amount: number
          batch_id: string
          created_at: string
          created_by: string
          cut_id: string
          id: string
          project_id: string
          reason: string
          reverses_id: string | null
          staff_id: string
          work_type_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracker_pay_adjustments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tracker_claim_emails: {
        Args: { p_lease: string; p_limit: number }
        Returns: {
          attempts: number
          claim_token: string | null
          claimed_until: string | null
          created_at: string
          created_by: string | null
          cut_id: string | null
          error: string | null
          id: string
          idempotency_key: string
          kind: string
          payload: Json
          ref_date: string | null
          resend_id: string | null
          staff_id: string | null
          status: string
          subject: string
          task_id: string | null
          to_email: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracker_email_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tracker_claim_notices: {
        Args: { p_lease: string; p_limit: number }
        Returns: {
          claimed_until: string | null
          cycle_id: string
          due_at: string
          first_change_at: string
          generation: number
          removed: Json
          staff_id: string
          task_ids: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "tracker_notice_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tracker_create_project: {
        Args: { p_color: string; p_name: string; p_types: Json }
        Returns: {
          archived_at: string | null
          color: string
          created_at: string
          id: string
          links: Json
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tracker_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tracker_create_task: {
        Args: {
          p_budget?: number
          p_cut_code: string
          p_end: string
          p_is_fix?: boolean
          p_project: string
          p_staff: string
          p_start: string
          p_type: string
        }
        Returns: Json
      }
      tracker_ensure_cut: {
        Args: { p_code: string; p_project: string }
        Returns: {
          budget: number
          code: string
          created_at: string
          id: string
          links: Json
          pay_split: Json | null
          project_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tracker_cuts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tracker_move_task: {
        Args: {
          p_end: string
          p_expected_version: number
          p_move_adjustments: boolean
          p_op: string
          p_reason: string
          p_staff: string
          p_start: string
          p_task: string
        }
        Returns: {
          created_at: string
          cut_id: string
          end_date: string
          id: string
          is_fix: boolean
          links: Json
          progress: number
          project_id: string
          staff_id: string
          start_date: string
          updated_at: string
          version: number
          work_type_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracker_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tracker_normalize_cut: { Args: { raw: string }; Returns: string }
      tracker_save_work_types: {
        Args: { p_project: string; p_types: Json }
        Returns: {
          code: string
          color: string
          created_at: string
          id: string
          label: string
          overlaps_prev: boolean
          pay_pct: number
          project_id: string
          sort_order: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracker_work_types"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tracker_set_cut_splits: {
        Args: { p_cuts: string[]; p_project: string; p_split: Json }
        Returns: {
          budget: number
          code: string
          created_at: string
          id: string
          links: Json
          pay_split: Json | null
          project_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracker_cuts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
    Enums: {},
  },
} as const
