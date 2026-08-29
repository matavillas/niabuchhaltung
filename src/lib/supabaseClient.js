import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pxzdkyvndosikdmstnpp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qpej7F47va30On464iajww_VVSYGlWU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
