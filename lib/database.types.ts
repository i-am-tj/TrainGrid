
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "follows": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"followee_id": string,"follower_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"followee_id": string,"follower_id"?: string,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"followee_id"?: string,"follower_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "social_profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "social_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"invitation_email_deliveries": {
                  Row: {
                    "created_at": string,"failure_code": string | null,"finished_at": string | null,"id": string,"invitation_id": string,"provider": string,"provider_message_id": string | null,"requested_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"failure_code"?: string | null,"finished_at"?: string | null,"id"?: string,"invitation_id": string,"provider"?: string,"provider_message_id"?: string | null,"requested_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"failure_code"?: string | null,"finished_at"?: string | null,"id"?: string,"invitation_id"?: string,"provider"?: string,"provider_message_id"?: string | null,"requested_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitation_email_deliveries_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: false
      referencedRelation: "invitations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"id": string,"invited_by": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"invite_requests": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"ip_hash": string | null,"name": string | null,"note": string | null,"resolved_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"ip_hash"?: string | null,"name"?: string | null,"note"?: string | null,"resolved_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"ip_hash"?: string | null,"name"?: string | null,"note"?: string | null,"resolved_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"member_feedback": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"message": string,"page_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"message": string,"page_path"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"message"?: string,"page_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"revoked_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"revoked_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"revoked_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routines": {
                  Row: {
                    "category": string,"created_at": string,"description": string,"id": string,"name": string,"owner_user_id": string | null,"scope": string,"slug": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"description"?: string,"id"?: string,"name": string,"owner_user_id"?: string | null,"scope": string,"slug"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"owner_user_id"?: string | null,"scope"?: string,"slug"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routines_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"scheduled_sessions": {
                  Row: {
                    "category": string,"created_at": string,"date": string,"duration_minutes": number | null,"id": string,"name": string,"notes": string,"snapshot": NonNullable<Json>,"source_routine_id": string | null,"start_time": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"date": string,"duration_minutes"?: number | null,"id"?: string,"name": string,"notes"?: string,"snapshot"?: NonNullable<Json>,"source_routine_id"?: string | null,"start_time"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"date"?: string,"duration_minutes"?: number | null,"id"?: string,"name"?: string,"notes"?: string,"snapshot"?: NonNullable<Json>,"source_routine_id"?: string | null,"start_time"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scheduled_sessions_source_routine_id_fkey"
      columns: ["source_routine_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scheduled_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_posts": {
                  Row: {
                    "author_id": string,"caption": string,"created_at": string,"edited_at": string | null,"id": string,"session_category": string,"session_date": string,"session_duration_minutes": number | null,"session_id": string | null,"session_name": string,"shows_duration": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"caption"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"session_category": string,"session_date": string,"session_duration_minutes"?: number | null,"session_id"?: string | null,"session_name": string,"shows_duration"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"caption"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"session_category"?: string,"session_date"?: string,"session_duration_minutes"?: number | null,"session_id"?: string | null,"session_name"?: string,"shows_duration"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "social_profiles"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "session_posts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "scheduled_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"social_profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string,"created_at": string,"display_name": string,"updated_at": string,"use_identity_avatar": boolean,"user_id": string,"username": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string,"created_at"?: string,"display_name": string,"updated_at"?: string,"use_identity_avatar"?: boolean,"user_id"?: string,"username": string,"visibility"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string,"created_at"?: string,"display_name"?: string,"updated_at"?: string,"use_identity_avatar"?: boolean,"user_id"?: string,"username"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "social_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_items": {
                  Row: {
                    "created_at": string,"equipment": (string)[],"id": string,"instruction": string,"name": string,"notes": string,"rest": string,"routine_id": string,"sort_order": number,"target": string,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"equipment"?: (string)[],"id"?: string,"instruction"?: string,"name": string,"notes"?: string,"rest"?: string,"routine_id": string,"sort_order": number,"target"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"equipment"?: (string)[],"id"?: string,"instruction"?: string,"name"?: string,"notes"?: string,"rest"?: string,"routine_id"?: string,"sort_order"?: number,"target"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_items_routine_id_fkey"
      columns: ["routine_id"]
isOneToOne: false
      referencedRelation: "routines"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_logs": {
                  Row: {
                    "created_at": string,"entries": NonNullable<Json>,"finished_at": string | null,"id": string,"notes": string,"session_id": string,"started_at": string,"status": string,"unit": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entries"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"notes"?: string,"session_id": string,"started_at"?: string,"status"?: string,"unit"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"entries"?: NonNullable<Json>,"finished_at"?: string | null,"id"?: string,"notes"?: string,"session_id"?: string,"started_at"?: string,"status"?: string,"unit"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_logs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "scheduled_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"begin_invitation_email":
{ Args: { "p_invitation_id": string,"p_requested_by": string }; Returns: {
              "delivery_id": string,"outcome": string,"recipient_email": string
            }[]
                           },
"complete_invitation_email":
{ Args: { "p_delivery_id": string,"p_failure_code"?: string,"p_provider_message_id"?: string,"p_status": string }; Returns: string
                           },
"is_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"request_invite":
{ Args: { "p_email": string,"p_ip_hash"?: string,"p_name"?: string,"p_note"?: string }; Returns: string
                           },
"revoke_invitation":
{ Args: { "p_invitation_id": string,"p_protected_user_ids": (string)[] }; Returns: string
                           },
"save_personal_routine":
{ Args: { "p_category": string,"p_description": string,"p_items": Json,"p_name": string,"p_routine_id": string }; Returns: string
                           },
"search_social_profiles":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "avatar_url": string,"bio": string,"display_name": string,"user_id": string,"username": string,"visibility": string
            }[]
                           },
"social_posts":
{ Args: { "p_author"?: string,"p_before_created_at"?: string,"p_before_id"?: string,"p_limit"?: number }; Returns: {
              "author_avatar_url": string,"author_display_name": string,"author_id": string,"author_username": string,"caption": string,"created_at": string,"edited_at": string,"id": string,"session_category": string,"session_date": string,"session_duration_minutes": number,"session_name": string,"shows_duration": boolean
            }[]
                           },
"social_profile":
{ Args: { "p_username": string }; Returns: {
              "avatar_url": string,"bio": string,"can_view_posts": boolean,"created_at": string,"display_name": string,"follower_count": number,"following_count": number,"follows_viewer": string,"is_self": boolean,"post_count": number,"user_id": string,"username": string,"viewer_follow": string,"visibility": string
            }[]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
