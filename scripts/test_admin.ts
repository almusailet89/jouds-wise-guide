import { createClient } from '@supabase/supabase-js';
import { assert } from 'console';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test admin user credentials
const ADMIN_USER = {
  email: 'test+admin@example.com',
  password: 'testpassword123'
};

// Regular test user credentials
const REGULAR_USER = {
  email: 'test+regular@example.com',
  password: 'testpassword123'
};

async function testAdminEndpoint() {
  // Setup
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Create admin user
  const { data: { user: adminUser, session: adminSession }, error: adminAuthError } = 
    await supabase.auth.signUp(ADMIN_USER);
  assert(!adminAuthError, 'Failed to create admin user');
  
  // Assign admin role
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ user_id: adminUser!.id, role: 'admin' });
  assert(!roleError, 'Failed to assign admin role');
  
  // Create regular user
  const { data: { session: regularSession }, error: regularAuthError } = 
    await supabase.auth.signUp(REGULAR_USER);
  assert(!regularAuthError, 'Failed to create regular user');
  
  // Test admin access
  const { data: adminData, error: adminError } = await supabase
    .functions.invoke('admin-actions', {
      headers: { Authorization: `Bearer ${adminSession?.access_token}` }
    });
  assert(!adminError && Array.isArray(adminData?.users), 'Admin access failed');
  
  // Test regular user access (should fail)
  const { error: regularError } = await supabase
    .functions.invoke('admin-actions', {
      headers: { Authorization: `Bearer ${regularSession?.access_token}` }
    });
  assert(regularError?.message.includes('Forbidden'), 'Regular user access check failed');
  
  console.log('✅ All admin endpoint tests passed');
  
  // Cleanup
  await supabase.auth.admin.deleteUser(adminUser!.id);
  await supabase.from('user_roles').delete().eq('user_id', adminUser!.id);
}

testAdminEndpoint().catch(console.error);
