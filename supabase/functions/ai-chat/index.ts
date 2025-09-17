import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Get user context for personalized responses
    const authHeader = req.headers.get("Authorization");
    let userContext = "";
    
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      
      if (userData.user) {
        // Get user profile for context
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('user_id', userData.user.id)
          .single();

        if (profile) {
          userContext = `User profile: ${profile.display_name || 'User'}, interests: ${profile.interests?.join(', ') || 'Not specified'}, base currency: ${profile.base_currency}, risk profile: ${profile.risk_profile}`;
        }
      }
    }

    const systemPrompt = `You are Joud, an elegant AI financial secretary with a sophisticated, warm, and professional tone. You embody the grace of a princess with the expertise of a financial advisor.

Your personality:
- Speak with elegance and refinement, using phrases that convey both warmth and expertise
- Address users with gentle respect, as if serving royalty
- Mix professional financial knowledge with personal care and attention
- Use sophisticated vocabulary while remaining accessible
- Show genuine interest in the user's financial wellbeing and personal goals

Your capabilities:
- Financial planning and investment advice
- Expense tracking and budgeting guidance  
- Task and schedule management
- Lifestyle and wellness coaching
- Mood tracking insights
- Personalized recommendations based on user data

${userContext ? `User context: ${userContext}` : ''}

Always respond as Joud would - with elegance, expertise, and genuine care for the user's financial and personal success.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(context || []),
          { role: 'user', content: message }
        ],
        max_completion_tokens: 1000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get AI response');
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Store the interaction for context memory
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      
      if (userData.user) {
        await supabaseClient
          .from('ai_interactions')
          .insert({
            user_id: userData.user.id,
            message,
            response: aiMessage,
            context_data: context || {}
          });
      }
    }

    return new Response(JSON.stringify({ 
      message: aiMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});