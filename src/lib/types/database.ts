// Placeholder types. Run `pnpm db:types` (with a linked Supabase project + creds) to
// generate the real one. The shape below matches the current migrations closely enough.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null; time_zone: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; primary_color?: string | null; time_zone?: string | null };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; tenant_id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null; avatar_url: string | null; role: string; status: string; last_login_at: string | null; created_at: string; updated_at: string };
        Insert: { id: string; tenant_id: string; email: string; first_name?: string | null; last_name?: string | null; phone?: string | null; avatar_url?: string | null; role?: string; status?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: { id: string; tenant_id: string; title: string; slug: string | null; department_id: string | null; business_unit_id: string | null; location_id: string | null; experience_min: number | null; experience_max: number | null; description: string | null; skills: string[]; employment_type: string | null; salary_min: number | null; salary_max: number | null; salary_currency: string | null; openings: number; hires: number; priority: boolean; confidential: boolean; status: "draft" | "active" | "archived" | "closed"; visibility: "internal" | "career_site" | "external" | "confidential"; target_close_date: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { tenant_id: string; title: string; slug?: string | null; department_id?: string | null; business_unit_id?: string | null; location_id?: string | null; experience_min?: number | null; experience_max?: number | null; description?: string | null; skills?: string[]; employment_type?: string | null; salary_min?: number | null; salary_max?: number | null; salary_currency?: string | null; openings?: number; hires?: number; priority?: boolean; confidential?: boolean; status?: "draft" | "active" | "archived" | "closed"; visibility?: "internal" | "career_site" | "external" | "confidential"; target_close_date?: string | null; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      candidates: {
        Row: { id: string; tenant_id: string; first_name: string; middle_name: string | null; last_name: string | null; email: string | null; phone: string | null; gender: string | null; date_of_birth: string | null; current_location: string | null; preferred_location: string | null; current_company: string | null; current_salary: number | null; current_salary_currency: string | null; expected_salary: number | null; expected_salary_currency: string | null; experience_years: number | null; experience_months: number | null; notice_period_days: number | null; linkedin_url: string | null; github_url: string | null; portfolio_url: string | null; source: string | null; owner_id: string | null; is_archived: boolean; archive_reason: string | null; created_at: string; updated_at: string };
        Insert: { tenant_id: string; first_name: string; middle_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null; gender?: string | null; date_of_birth?: string | null; current_location?: string | null; preferred_location?: string | null; current_company?: string | null; current_salary?: number | null; current_salary_currency?: string | null; expected_salary?: number | null; expected_salary_currency?: string | null; experience_years?: number | null; experience_months?: number | null; notice_period_days?: number | null; source?: string | null; owner_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>;
        Relationships: [];
      };
      applications: {
        Row: { id: string; tenant_id: string; candidate_id: string; job_id: string; current_stage_id: string | null; overall_decision: "pending" | "recommend" | "hold" | "reject"; applied_via: string | null; applied_at: string; is_archived: boolean; archive_reason: string | null; created_by: string | null; updated_at: string };
        Insert: { tenant_id: string; candidate_id: string; job_id: string; current_stage_id?: string | null; overall_decision?: "pending" | "recommend" | "hold" | "reject"; applied_via?: string | null; applied_at?: string; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      stages: {
        Row: { id: string; tenant_id: string; code: string; name: string; order: number; color: string | null; is_terminal: boolean; is_archived: boolean; created_at: string };
        Insert: { tenant_id: string; code: string; name: string; order?: number; color?: string | null; is_terminal?: boolean };
        Update: Partial<Database["public"]["Tables"]["stages"]["Insert"]>;
        Relationships: [];
      };
      departments:           { Row: { id: string; tenant_id: string; name: string; is_archived: boolean; created_at: string }; Insert: { tenant_id: string; name: string }; Update: { name?: string; is_archived?: boolean }; Relationships: [] };
      locations:             { Row: { id: string; tenant_id: string; name: string; city: string | null; country: string | null; is_archived: boolean; created_at: string }; Insert: { tenant_id: string; name: string; city?: string | null; country?: string | null }; Update: { name?: string; city?: string | null; country?: string | null; is_archived?: boolean }; Relationships: [] };
      business_units:        { Row: { id: string; tenant_id: string; name: string; is_archived: boolean; created_at: string }; Insert: { tenant_id: string; name: string }; Update: { name?: string; is_archived?: boolean }; Relationships: [] };
      skills:                { Row: { id: string; tenant_id: string; name: string; created_at: string }; Insert: { tenant_id: string; name: string }; Update: { name?: string }; Relationships: [] };
      tags:                  { Row: { id: string; tenant_id: string; name: string; color: string | null; created_at: string }; Insert: { tenant_id: string; name: string; color?: string | null }; Update: { name?: string; color?: string | null }; Relationships: [] };
      job_team:              { Row: { job_id: string; user_id: string; role_on_job: string; created_at: string }; Insert: { job_id: string; user_id: string; role_on_job: string }; Update: { role_on_job?: string }; Relationships: [] };
      notes:                 { Row: { id: string; tenant_id: string; application_id: string; author_id: string | null; body: string; created_at: string }; Insert: { tenant_id: string; application_id: string; author_id?: string | null; body: string }; Update: { body?: string }; Relationships: [] };
      documents:             { Row: { id: string; tenant_id: string; candidate_id: string | null; application_id: string | null; kind: string; name: string; mime: string | null; size_bytes: number | null; storage_bucket: string; storage_path: string; uploaded_by: string | null; version: number; created_at: string }; Insert: { tenant_id: string; candidate_id?: string | null; application_id?: string | null; kind?: string; name: string; mime?: string | null; size_bytes?: number | null; storage_bucket?: string; storage_path: string; uploaded_by?: string | null; version?: number }; Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>; Relationships: [] };
      candidate_experiences: { Row: { id: string; candidate_id: string; company: string | null; title: string | null; start_date: string | null; end_date: string | null; is_current: boolean; description: string | null; created_at: string }; Insert: { candidate_id: string; company?: string | null; title?: string | null; start_date?: string | null; end_date?: string | null; is_current?: boolean; description?: string | null }; Update: Partial<Database["public"]["Tables"]["candidate_experiences"]["Insert"]>; Relationships: [] };
      candidate_educations:  { Row: { id: string; candidate_id: string; institution: string | null; degree: string | null; field: string | null; start_year: number | null; end_year: number | null; grade: string | null; created_at: string }; Insert: { candidate_id: string; institution?: string | null; degree?: string | null; field?: string | null; start_year?: number | null; end_year?: number | null; grade?: string | null }; Update: Partial<Database["public"]["Tables"]["candidate_educations"]["Insert"]>; Relationships: [] };
      candidate_skills:      { Row: { candidate_id: string; skill_id: string }; Insert: { candidate_id: string; skill_id: string }; Update: { candidate_id?: string; skill_id?: string }; Relationships: [] };
      application_stage_history: { Row: { id: string; application_id: string; from_stage_id: string | null; to_stage_id: string; moved_by: string | null; comment: string | null; moved_at: string }; Insert: { application_id: string; to_stage_id: string; from_stage_id?: string | null; moved_by?: string | null; comment?: string | null }; Update: Partial<Database["public"]["Tables"]["application_stage_history"]["Insert"]>; Relationships: [] };
      interviews:            { Row: { id: string; tenant_id: string; application_id: string; stage_id: string | null; mode: string; scheduled_start: string; scheduled_end: string; location_or_link: string | null; status: string; created_by: string | null; created_at: string }; Insert: { tenant_id: string; application_id: string; scheduled_start: string; scheduled_end: string; stage_id?: string | null; mode?: string; location_or_link?: string | null; status?: string; created_by?: string | null }; Update: Partial<Database["public"]["Tables"]["interviews"]["Insert"]>; Relationships: [] };
      templates:             { Row: { id: string; tenant_id: string; kind: string; name: string; subject: string | null; body: string | null; variables: Json; is_default: boolean; created_at: string; updated_at: string }; Insert: { tenant_id: string; kind: string; name: string; subject?: string | null; body?: string | null; variables?: Json; is_default?: boolean }; Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>; Relationships: [] };
    };
    Views: {
      v_jobs_with_counts: {
        Row: Database["public"]["Tables"]["jobs"]["Row"] & {
          department_name: string | null;
          location_name: string | null;
          business_unit_name: string | null;
          candidate_count: number;
          new_candidates_count: number;
          archived_candidates_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      move_application_stage: {
        Args: { p_application_id: string; p_to_stage_id: string; p_comment?: string };
        Returns: { id: string; application_id: string; from_stage_id: string | null; to_stage_id: string; moved_by: string | null; comment: string | null; moved_at: string };
      };
      job_funnel: {
        Args: { p_job_id: string };
        Returns: { stage_id: string; stage_name: string; stage_order: number; count: number }[];
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
