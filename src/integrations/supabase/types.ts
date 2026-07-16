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
      cartelle: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordine: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordine?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordine?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      lista_spesa: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          nome: string
          quantita: string | null
          reparto: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          nome: string
          quantita?: string | null
          reparto?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          nome?: string
          quantita?: string | null
          reparto?: string
        }
        Relationships: []
      }
      prezzi_prodotti: {
        Row: {
          created_at: string
          data_rilevazione: string
          fonte: string
          foto_scontrino: string | null
          id: string
          nome_prodotto: string
          prezzo: number
          supermercato: string
          unita: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_rilevazione?: string
          fonte?: string
          foto_scontrino?: string | null
          id?: string
          nome_prodotto: string
          prezzo: number
          supermercato?: string
          unita?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_rilevazione?: string
          fonte?: string
          foto_scontrino?: string | null
          id?: string
          nome_prodotto?: string
          prezzo?: number
          supermercato?: string
          unita?: string
          updated_at?: string
        }
        Relationships: []
      }
      ricetta_ingredienti: {
        Row: {
          created_at: string
          gruppo: string | null
          id: string
          nome_ingrediente: string
          note: string | null
          posizione: number
          quantita: number | null
          quantita_max: number | null
          ricetta_id: string
          unita: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          gruppo?: string | null
          id?: string
          nome_ingrediente: string
          note?: string | null
          posizione?: number
          quantita?: number | null
          quantita_max?: number | null
          ricetta_id: string
          unita?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          gruppo?: string | null
          id?: string
          nome_ingrediente?: string
          note?: string | null
          posizione?: number
          quantita?: number | null
          quantita_max?: number | null
          ricetta_id?: string
          unita?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ricetta_ingredienti_ricetta_id_fkey"
            columns: ["ricetta_id"]
            isOneToOne: false
            referencedRelation: "ricette"
            referencedColumns: ["id"]
          },
        ]
      }
      ricette: {
        Row: {
          carboidrati_g: number | null
          cartella_id: string | null
          categoria: string | null
          congelabile: boolean | null
          created_at: string
          da_rifare: boolean | null
          grassi_g: number | null
          id: string
          immagine_url: string | null
          ingredienti: string[] | null
          kcal: number | null
          modifiche: string | null
          note: string | null
          proteine_g: number | null
          scaling_francesco: string | null
          stagionalita: string[] | null
          tag: string[]
          tempo_minuti: number | null
          tipo: string | null
          titolo: string
          updated_at: string
          varianti: string[] | null
          voto: number | null
        }
        Insert: {
          carboidrati_g?: number | null
          cartella_id?: string | null
          categoria?: string | null
          congelabile?: boolean | null
          created_at?: string
          da_rifare?: boolean | null
          grassi_g?: number | null
          id: string
          immagine_url?: string | null
          ingredienti?: string[] | null
          kcal?: number | null
          modifiche?: string | null
          note?: string | null
          proteine_g?: number | null
          scaling_francesco?: string | null
          stagionalita?: string[] | null
          tag?: string[]
          tempo_minuti?: number | null
          tipo?: string | null
          titolo: string
          updated_at?: string
          varianti?: string[] | null
          voto?: number | null
        }
        Update: {
          carboidrati_g?: number | null
          cartella_id?: string | null
          categoria?: string | null
          congelabile?: boolean | null
          created_at?: string
          da_rifare?: boolean | null
          grassi_g?: number | null
          id?: string
          immagine_url?: string | null
          ingredienti?: string[] | null
          kcal?: number | null
          modifiche?: string | null
          note?: string | null
          proteine_g?: number | null
          scaling_francesco?: string | null
          stagionalita?: string[] | null
          tag?: string[]
          tempo_minuti?: number | null
          tipo?: string | null
          titolo?: string
          updated_at?: string
          varianti?: string[] | null
          voto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ricette_cartella_id_fkey"
            columns: ["cartella_id"]
            isOneToOne: false
            referencedRelation: "cartelle"
            referencedColumns: ["id"]
          },
        ]
      }
      ricette_da_provare: {
        Row: {
          created_at: string
          data_aggiunta: string
          id: string
          link_video: string | null
          note: string
          stato: string
          titolo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_aggiunta?: string
          id?: string
          link_video?: string | null
          note?: string
          stato?: string
          titolo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_aggiunta?: string
          id?: string
          link_video?: string | null
          note?: string
          stato?: string
          titolo?: string
          updated_at?: string
        }
        Relationships: []
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
