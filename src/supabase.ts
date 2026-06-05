import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqdrdpidyxxbwphstdpz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZHJkcGlkeXh4YndwaHN0ZHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDY2MTQsImV4cCI6MjA5NjIyMjYxNH0.Z5AfS0ZOIJ4b_WNG81YYvl5jegP2Y4kEuOo2XUqn8Wc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
