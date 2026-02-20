import { createClient } from '@supabase/supabase-js'

// TODO: Replace these with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://dmsnhtrelwcdqgsqpwjd.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_V_unMafYT5DVfA5-bSA1dA_YAbd_1eO'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
