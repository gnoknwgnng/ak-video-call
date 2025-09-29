const { createClient } = require('@supabase/supabase-js');

// Use your specific Supabase credentials
const supabaseUrl = 'https://ptqjnuquemfelgutgilp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cWpudXF1ZW1mZWxndXRnaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTYxNTgsImV4cCI6MjA3NDczMjE1OH0.nUbAY5kWglAHVxio7uEB_ZzktCaz5tZ93vZic3G2XEU';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test connection by fetching tables
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return;
    }
    
    console.log('Supabase connection successful!');
    console.log('Tables exist and are accessible');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testSupabase();