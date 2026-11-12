
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "invitations": {
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
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"save_personal_routine":
{ Args: { "p_category": string,"p_description": string,"p_items": Json,"p_name": string,"p_routine_id": string }; Returns: string
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
