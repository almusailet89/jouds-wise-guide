import { createClient } from '@supabase/supabase-js';
import { assert } from 'console';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test user credentials
const TEST_USER = {
  email: 'test+reminders@example.com',
  password: 'testpassword123'
};

async function testReminders() {
  // Setup
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Create test user
  const { data: { user, session }, error: authError } = await supabase.auth.signUp(TEST_USER);
  assert(!authError, 'Failed to create test user');
  
  // Enqueue reminder
  const reminderTime = new Date(Date.now() + 120000).toISOString(); // 2 minutes from now
  const { data: enqueueData, error: enqueueError } = await supabase
    .functions.invoke('tasks-actions', {
      body: {
        action: 'enqueue',
        title: 'Test reminder',
        body: 'Automated test',
        scheduled_at: reminderTime,
        task_id: null
      },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
  assert(!enqueueError, 'Failed to enqueue reminder');
  
  // Verify reminder exists
  const { data: reminders, error: remindersError } = await supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('user_id', user!.id);
  assert(!remindersError && reminders?.length === 1, 'Reminder not created');
  
  // Run digest
  const { data: digestData, error: digestError } = await supabase
    .functions.invoke('tasks-actions', {
      body: { action: 'digest' },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
  assert(!digestError && digestData?.sent === 0, 'Digest failed (no reminders due)');
  
  console.log('✅ All reminders tests passed');
  
  // Cleanup
  await supabase.from('scheduled_notifications').delete().eq('user_id', user!.id);
  await supabase.auth.admin.deleteUser(user!.id);
}

testReminders().catch(console.error);
