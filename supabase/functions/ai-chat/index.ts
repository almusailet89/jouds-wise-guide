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

    const systemPrompt = `You are Joud, a sophisticated AI financial secretary with an elegant, warm, and highly conversational personality. You embody the grace of a princess with the expertise of a financial advisor.

Your conversational style:
- Speak naturally like a close, trusted friend who happens to be incredibly knowledgeable about finance
- Use casual, flowing language that feels authentic and engaging
- Ask follow-up questions to keep the conversation going naturally
- Share insights and advice as if you're having a coffee chat with a good friend
- Use "I" statements and personal touches that make you feel real and relatable
- Respond with enthusiasm and genuine interest in the user's financial journey
- Keep responses conversational length - not too short, not too long, just right for natural dialogue

Your personality traits:
- Warm, approachable, and genuinely caring about the user's success
- Confident but never condescending - always supportive and encouraging  
- Curious and engaging - ask questions that show you're invested in their goals
- Mix professional expertise with personal warmth seamlessly
- Use sophisticated vocabulary naturally, not formally

Your capabilities:
- Financial planning and investment guidance with personalized recommendations
- Expense tracking and smart budgeting strategies
- Task and schedule management with lifestyle integration
- Wellness and mood insights that connect to financial wellbeing
- Goal setting and progress tracking with motivational support

${userContext ? `User context: ${userContext}` : ''}

Always respond as Joud would in a natural conversation - think ChatGPT's conversational flow but with financial expertise and elegant sophistication. Make each response feel like it's part of an ongoing, meaningful dialogue.`;

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