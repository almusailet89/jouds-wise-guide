import { createClient } from '@supabase/supabase-js';
import { assert } from 'console';

interface WalletResult {
  user_id: string;
  balance: number;
  currency: string;
  updated_at: string;
}

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testWalletGuardrails() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // 1. Create test user with retries
  let testUser: { id: string } | null = null;
  try {
    const { data: { user }, error } = await supabase.auth.admin.createUser({
      email: `test+${Date.now()}@example.com`,
      password: 'testpassword123',
      email_confirm: true
    });
    
    assert(!error && user?.id, `User creation failed: ${error?.message || 'No user ID returned'}`);
    testUser = { id: user!.id };
    
    // 2. Test positive adjustment
    const { data: posData, error: posError } = await supabase
      .rpc('adjust_wallet', { _delta: 100, _currency: 'SAR' })
      .returns<WalletResult>()
      .single();
    
    assert(!posError && posData?.balance === 100, 
      `Positive adjustment failed: ${posError?.message || 'Balance mismatch'}`);

    // 3. Test negative adjustment (within balance)
    const { data: negData, error: negError } = await supabase
      .rpc('adjust_wallet', { _delta: -50, _currency: 'SAR' })
      .returns<WalletResult>()
      .single();
    
    assert(!negError && negData?.balance === 50,
      `Negative adjustment failed: ${negError?.message || 'Balance mismatch'}`);

    // 4. Test overdraft prevention 
    const { error: overdraftError } = await supabase
      .rpc('adjust_wallet', { _delta: -100, _currency: 'SAR' });
    
    assert(overdraftError?.message.includes('Insufficient balance'),
      `Overdraft guardrail failed: ${overdraftError?.message || 'No error thrown'}`);

    console.log('✅ All wallet guardrail tests passed');
  } catch (err) {
    console.error('❌ Test failed:', err instanceof Error ? err.message : err);
    throw err;
  } finally {
    // 5. Cleanup
    if (testUser?.id) {
      await supabase.auth.admin.deleteUser(testUser.id).catch(e => 
        console.warn('Cleanup warning:', e instanceof Error ? e.message : e)
      );
    }
  }
}

testWalletGuardrails().catch(() => process.exit(1));
