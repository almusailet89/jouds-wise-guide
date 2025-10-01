import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Function calling tools for "Jood, note this" actions
const functionTools = [
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Add a new task to the user's task list",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The task title" },
          due_date: { type: "string", description: "Due date in ISO format (optional)" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority (optional)" },
          notes: { type: "string", description: "Additional notes (optional)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_financial_entry",
      description: "Add a financial entry (expense, income, or savings)",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["expense", "income", "savings"], description: "Type of financial entry" },
          amount: { type: "number", description: "Amount in the specified currency" },
          currency: { type: "string", description: "Currency code (USD, SAR, EUR, etc.)" },
          category: { type: "string", description: "Category or label (optional)" },
          description: { type: "string", description: "Description or note (optional)" },
          date: { type: "string", description: "Date in ISO format (optional, defaults to now)" }
        },
        required: ["type", "amount", "currency"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_stock_to_portfolio",
      description: "Add a stock to the user's portfolio",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock symbol (e.g., AAPL, TSLA)" },
          quantity: { type: "number", description: "Number of shares" },
          buy_price: { type: "number", description: "Purchase price per share" },
          currency: { type: "string", description: "Currency code (optional, defaults to USD)" },
          date: { type: "string", description: "Purchase date in ISO format (optional)" }
        },
        required: ["symbol", "quantity", "buy_price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_crypto_to_portfolio",
      description: "Add cryptocurrency to the user's portfolio",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Crypto symbol (e.g., BTC, ETH)" },
          quantity: { type: "number", description: "Amount of cryptocurrency" },
          buy_price: { type: "number", description: "Purchase price per unit" },
          currency: { type: "string", description: "Currency code (optional, defaults to USD)" },
          date: { type: "string", description: "Purchase date in ISO format (optional)" }
        },
        required: ["symbol", "quantity", "buy_price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_real_estate",
      description: "Add real estate to the user's portfolio",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Property address or location" },
          property_type: { type: "string", description: "Type of property (villa, apartment, etc.)" },
          purchase_price: { type: "number", description: "Purchase price" },
          currency: { type: "string", description: "Currency code (optional, defaults to SAR)" },
          sqft: { type: "number", description: "Square footage (optional)" },
          purchase_date: { type: "string", description: "Purchase date in ISO format (optional)" }
        },
        required: ["address", "property_type", "purchase_price"]
      }
    }
  }
  ,
  {
    type: "function",
    function: {
      name: "add_mood_log",
      description: "Log a mood entry with optional notes",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number", description: "Mood score (e.g., 1-10)" },
          mood: { type: "string", description: "Mood label (optional)" },
          notes: { type: "string", description: "Notes (optional)" },
          occurred_at: { type: "string", description: "ISO datetime when it happened (optional)" }
        },
        required: ["score"]
      }
    }
  }
  ,
  {
    type: "function",
    function: {
      name: "add_goal",
      description: "Create a goal with optional target date and amount",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Goal title" },
          notes: { type: "string", description: "Notes (optional)" },
          target_date: { type: "string", description: "Target date in ISO format (optional)" },
          amount_target: { type: "number", description: "Target amount (optional)" }
        },
        required: ["title"]
      }
    }
  }
  ,
  {
    type: "function",
    function: {
      name: "add_knowledge",
      description: "Store a knowledge note with optional tags and source",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title for the note" },
          content: { type: "string", description: "Note content (optional)" },
          tags: { type: "array", items: { type: "string" }, description: "Tags (optional)" },
          source: { type: "string", description: "Source or reference (optional)" }
        },
        required: ["title"]
      }
    }
  }
];

// Read-only tools for memory recall (auto-exec, no confirm)
const memoryTools = [
  {
    type: "function",
    function: {
      name: "memory_query",
      description: "Query user's memory across finance, tasks, mood, goals, and knowledge with natural language timeframes.",
      parameters: {
        type: "object",
        properties: {
          timeframe: { type: "string", description: "Timeframe like 'yesterday', 'last week', 'last month', or 'Q1/2025'", nullable: true },
          target: { type: "string", enum: ["finance", "tasks", "mood", "goals", "knowledge", "categories"], description: "Which area to query", nullable: true },
          categories: { type: "array", items: { type: "string" }, description: "Finance categories filter", nullable: true },
          tags: { type: "array", items: { type: "string" }, description: "Knowledge tags filter", nullable: true },
          question: { type: "string", description: "Optional natural language question for context", nullable: true }
        }
      }
    }
  }
];

// Execute function calls
async function executeFunction(functionCall: any, userId: string, supabase: any) {
  const { name, arguments: args } = functionCall;
  const parsedArgs = JSON.parse(args);
  
  console.log(`Executing function: ${name} with args:`, parsedArgs);
  
  switch (name) {
    case 'add_task':
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: parsedArgs.title,
          due_date: parsedArgs.due_date || null,
          priority: parsedArgs.priority || 'medium',
          description: parsedArgs.notes || null,
          status: 'pending'
        })
        .select()
        .single();
      
      if (taskError) throw taskError;
      return `Task "${parsedArgs.title}" added successfully.`;
    
    case 'add_financial_entry':
      const { data: finData, error: finError } = await supabase
        .from('financial_entries')
        .insert({
          user_id: userId,
          type: parsedArgs.type,
          amount: parsedArgs.amount,
          currency: parsedArgs.currency,
          category: parsedArgs.category || null,
          description: parsedArgs.description || null,
          occurred_at: parsedArgs.date || new Date().toISOString(),
        })
        .select()
        .single();
      
      if (finError) throw finError;
      return `${parsedArgs.type} of ${parsedArgs.amount} ${parsedArgs.currency} recorded successfully.`;
    
    case 'add_stock_to_portfolio':
      const { data: stockData, error: stockError } = await supabase
        .from('portfolio_holdings')
        .insert({
          user_id: userId,
          asset_type: 'stock',
          symbol: parsedArgs.symbol.toUpperCase(),
          quantity: parsedArgs.quantity,
          buy_price: parsedArgs.buy_price,
          avg_price: parsedArgs.buy_price,
          currency: parsedArgs.currency || 'USD',
          market: 'US',
          purchase_date: parsedArgs.date || new Date().toISOString()
        })
        .select()
        .single();
      
      if (stockError) throw stockError;
      return `Added ${parsedArgs.quantity} shares of ${parsedArgs.symbol} at $${parsedArgs.buy_price} per share.`;
    
    case 'add_crypto_to_portfolio':
      const { data: cryptoData, error: cryptoError } = await supabase
        .from('portfolio_holdings')
        .insert({
          user_id: userId,
          asset_type: 'crypto',
          symbol: parsedArgs.symbol.toUpperCase(),
          quantity: parsedArgs.quantity,
          buy_price: parsedArgs.buy_price,
          avg_price: parsedArgs.buy_price,
          currency: parsedArgs.currency || 'USD',
          market: 'CRYPTO',
          purchase_date: parsedArgs.date || new Date().toISOString()
        })
        .select()
        .single();
      
      if (cryptoError) throw cryptoError;
      return `Added ${parsedArgs.quantity} ${parsedArgs.symbol} at $${parsedArgs.buy_price} per unit.`;
    
    case 'add_real_estate':
      const { data: realEstateData, error: realEstateError } = await supabase
        .from('portfolio_holdings')
        .insert({
          user_id: userId,
          asset_type: 'real_estate',
          symbol: 'REAL_ESTATE',
          quantity: 1,
          buy_price: parsedArgs.purchase_price,
          avg_price: parsedArgs.purchase_price,
          currency: parsedArgs.currency || 'SAR',
          market: 'REAL_ESTATE',
          address: parsedArgs.address,
          property_type: parsedArgs.property_type,
          sqft: parsedArgs.sqft || null,
          purchase_price: parsedArgs.purchase_price,
          purchase_date: parsedArgs.purchase_date || new Date().toISOString()
        })
        .select()
        .single();
      
      if (realEstateError) throw realEstateError;
      return `Added ${parsedArgs.property_type} in ${parsedArgs.address} worth ${parsedArgs.purchase_price} ${parsedArgs.currency || 'SAR'}.`;
    
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, mode, pendingFunction } = await req.json();
    
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
    let userId = null;
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      
      if (userData.user) {
        userId = userData.user.id;
        
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

    // Detect "Jood, note this" trigger
    const isActionMode = message.toLowerCase().startsWith('jood, note this');
    const shouldPreview = isActionMode && mode !== 'commit';
    const shouldCommit = isActionMode && mode === 'commit';
    const isConfirmation = ['yes', 'confirm', 'ok', 'sure', 'proceed'].includes(message.toLowerCase().trim());
    const isEdit = message.toLowerCase().includes('edit');
    const isCancel = ['no', 'cancel', 'nevermind'].includes(message.toLowerCase().trim());

    let systemPrompt = `You are Jood, a sophisticated AI financial assistant with an elegant, warm, and highly conversational personality. You embody the grace of a princess with the expertise of a financial advisor.

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

${userContext ? `User context: ${userContext}` : ''}`;

    if (shouldPreview) {
      systemPrompt += `

IMPORTANT: The user said "Jood, note this" which means they want you to parse their request and show a preview BEFORE executing any actions. 

You MUST:
1. Parse their request using function calling tools
2. Respond with: "I will record this as requested: [natural language summary]"
3. Then show a structured preview of what will be saved
4. End with: "Please confirm: Yes / No / Edit."

DO NOT execute any database writes yet - this is preview mode only.`;
    } else if (shouldCommit || (isConfirmation && pendingFunction)) {
      systemPrompt += `

The user has confirmed they want to proceed with the action. Execute the function call and respond with "Consider it done." followed by a brief confirmation of what was saved.`;
    } else if (isCancel) {
      systemPrompt += `

The user has cancelled the action. Respond politely that you won't record the information and continue the conversation normally.`;
    } else {
      systemPrompt += `

Always respond as Jood would in a natural conversation - think ChatGPT's conversational flow but with financial expertise and elegant sophistication. Make each response feel like it's part of an ongoing, meaningful dialogue. Do not execute any database actions unless the user explicitly says "Jood, note this".`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context || []),
      { role: 'user', content: message }
    ];

    const isRegularChat = !shouldPreview && !shouldCommit && !isConfirmation && !isCancel;

    // SSE streaming path for regular chat (kept off for preview/confirm)
    if (isRegularChat && (req.headers.get('accept')?.includes('text/event-stream') || mode === 'stream' || mode === 'infinite')) {
      const sseHeaders = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      };

      const requestBody: any = {
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1000,
        stream: true,
      };

      const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!openaiResp.ok || !openaiResp.body) {
        const err = await openaiResp.text().catch(() => 'Failed to start stream');
        return new Response(`event: error\ndata: ${JSON.stringify({ error: err })}\n\n`, { status: 200, headers: sseHeaders });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = openaiResp.body!.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) controller.enqueue(value);
            }
          } catch (e) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ error: (e as Error).message })}\n\n`));
          } finally {
            reader.releaseLock();
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: sseHeaders });
    }

    const requestBody: any = {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1000,
      stream: false,
    };

    // Enable function calling for action mode or commit with pending function
    if (shouldPreview || (shouldCommit && pendingFunction)) {
      requestBody.tools = functionTools;
      requestBody.tool_choice = 'auto';
    } else if (isRegularChat) {
      // Allow memory query tool in normal conversation without confirmation
      requestBody.tools = memoryTools;
      requestBody.tool_choice = 'auto';
    }

    console.log('Sending request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get AI response');
    }

    const data = await response.json();
    const choice = data.choices[0];
    let assistantMessage = choice.message.content || '';
    let functionResults: any = null;

    // Handle cancellation
    if (isCancel) {
      assistantMessage = "Understood — I won't record that. Is there anything else I can help you with?";
    }
    // Auto-exec memory query tool in conversation mode
    else if (choice.message.tool_calls && isRegularChat) {
      try {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.function?.name === 'memory_query') {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          // Call the memory-query edge function with user's token
          const functionsBase = (Deno.env.get('SUPABASE_URL') || '').replace('.supabase.co', '.functions.supabase.co');
          const authHeader = req.headers.get('Authorization') || '';
          const resp = await fetch(`${functionsBase}/memory-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authHeader ? { 'Authorization': authHeader } : {}),
            },
            body: JSON.stringify({
              timeframe: args.timeframe,
              target: args.target,
              categories: args.categories,
              tags: args.tags,
              question: args.question,
            }),
          });

          if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(txt || 'memory-query failed');
          }
          const result = await resp.json();
          functionResults = result;
          const summary = result.summary_text || `Here is what I found for ${result.target} in ${result.timeframe}.`;
          assistantMessage = summary;
        }
      } catch (err) {
        console.error('memory_query tool error:', err);
        assistantMessage = 'I could not retrieve your past data right now.';
      }
    }
    // Handle function calls for commit mode
    else if ((shouldCommit || isConfirmation) && userId) {
      try {
        const functionCall = pendingFunction || choice.message.tool_calls?.[0]?.function;
        if (!functionCall) {
          assistantMessage = "I couldn't find the pending action to execute. Please try again.";
        } else {
          const name = functionCall.name;
          if (name === 'add_mood_log' || name === 'add_goal' || name === 'add_knowledge') {
            const args = JSON.parse(functionCall.arguments || '{}');
            const functionsBase = (Deno.env.get('SUPABASE_URL') || '').replace('.supabase.co', '.functions.supabase.co');
            const authHeader = req.headers.get('Authorization') || '';
            const resource = name === 'add_mood_log' ? 'mood' : name === 'add_goal' ? 'goal' : 'knowledge';
            const resp = await fetch(`${functionsBase}/assistant-actions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
              body: JSON.stringify({ method: 'POST', resource, body: args })
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => '');
              throw new Error(txt || 'assistant-actions failed');
            }
            const json = await resp.json();
            functionResults = json;
            if (name === 'add_mood_log') {
              assistantMessage = `Consider it done. Logged mood ${args.score}${args.mood ? ` (${args.mood})` : ''}.`;
            } else if (name === 'add_goal') {
              assistantMessage = `Consider it done. Goal "${args.title}" saved${args.target_date ? ` (target ${new Date(args.target_date).toLocaleDateString()})` : ''}.`;
            } else {
              assistantMessage = `Consider it done. Saved note "${args.title}"${Array.isArray(args.tags) && args.tags.length ? ` with tags ${args.tags.join(', ')}` : ''}.`;
            }
          } else if (name === 'add_financial_entry') {
            const args = JSON.parse(functionCall.arguments || '{}');
            const functionsBase = (Deno.env.get('SUPABASE_URL') || '').replace('.supabase.co', '.functions.supabase.co');
            const authHeader = req.headers.get('Authorization') || '';
            const resp = await fetch(`${functionsBase}/finance-actions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
              body: JSON.stringify({ body: {
                type: args.type,
                amount: Number(args.amount),
                currency: String(args.currency || 'SAR'),
                category: args.category ?? null,
                description: args.description ?? null,
                occurred_at: args.date || new Date().toISOString(),
              } })
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => '');
              throw new Error(txt || 'finance-actions failed');
            }
            const json = await resp.json();
            functionResults = json;
            if (json?.ok) {
              assistantMessage = `Consider it done. ${String(args.type).toLowerCase()} of ${args.amount} ${args.currency || 'SAR'} recorded.`;
            } else {
              assistantMessage = json?.message || 'I could not save that entry.';
            }
          } else if (name === 'add_stock_to_portfolio' || name === 'add_crypto_to_portfolio') {
            const args = JSON.parse(functionCall.arguments || '{}');
            const functionsBase = (Deno.env.get('SUPABASE_URL') || '').replace('.supabase.co', '.functions.supabase.co');
            const authHeader = req.headers.get('Authorization') || '';
            const resp = await fetch(`${functionsBase}/portfolio-actions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
              body: JSON.stringify({
                action: 'BUY',
                symbol: String(args.symbol || '').toUpperCase(),
                quantity: Number(args.quantity),
                price: Number(args.buy_price),
                currency: String(args.currency || 'SAR'),
              })
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => '');
              throw new Error(txt || 'portfolio-actions failed');
            }
            const json = await resp.json();
            functionResults = json;
            if (json?.ok) {
              assistantMessage = `Consider it done. Bought ${args.quantity} ${String(args.symbol).toUpperCase()} at ${args.buy_price} ${args.currency || 'SAR'}.`;
            } else {
              assistantMessage = json?.message || 'I could not execute that buy.';
            }
          } else {
            const result = await executeFunction(functionCall, userId, supabaseClient);
            functionResults = result;
            assistantMessage = `Consider it done. ${result}`;
          }
        }
      } catch (error) {
        console.error('Function execution error:', error);
        assistantMessage = `I encountered an error while trying to save that information: ${(error as any).message}. Please try again.`;
      }
    }
    // Handle function calls for preview mode
    else if (choice.message.tool_calls && shouldPreview) {
      const functionCall = choice.message.tool_calls[0].function;
      const parsedArgs = JSON.parse(functionCall.arguments);
      
      // Create a structured preview
      let preview = `I will record this as requested: `;
      
      switch (functionCall.name) {
        case 'add_task':
          preview += `Add task "${parsedArgs.title}"`;
          if (parsedArgs.due_date) preview += ` due ${new Date(parsedArgs.due_date).toLocaleDateString()}`;
          if (parsedArgs.priority) preview += ` with ${parsedArgs.priority} priority`;
          break;
        case 'add_financial_entry':
          preview += `${parsedArgs.type} of ${parsedArgs.amount} ${parsedArgs.currency}`;
          if (parsedArgs.category) preview += ` for ${parsedArgs.category}`;
          break;
        case 'add_mood_log':
          preview += `Mood ${parsedArgs.score}${parsedArgs.mood ? ` (${parsedArgs.mood})` : ''}`;
          if (parsedArgs.notes) preview += ` with note`;
          break;
        case 'add_goal':
          preview += `Goal "${parsedArgs.title}"`;
          if (parsedArgs.target_date) preview += ` target ${new Date(parsedArgs.target_date).toLocaleDateString()}`;
          if (parsedArgs.amount_target) preview += ` amount ${parsedArgs.amount_target}`;
          break;
        case 'add_knowledge':
          preview += `Knowledge "${parsedArgs.title}"`;
          if (Array.isArray(parsedArgs.tags) && parsedArgs.tags.length) preview += ` with tags ${parsedArgs.tags.join(', ')}`;
          break;
        case 'add_stock_to_portfolio':
          preview += `${parsedArgs.quantity} shares of ${parsedArgs.symbol} at $${parsedArgs.buy_price}`;
          break;
        case 'add_crypto_to_portfolio':
          preview += `${parsedArgs.quantity} ${parsedArgs.symbol} at $${parsedArgs.buy_price}`;
          break;
        case 'add_real_estate':
          preview += `${parsedArgs.property_type} in ${parsedArgs.address} for ${parsedArgs.purchase_price} ${parsedArgs.currency || 'SAR'}`;
          break;
      }
      
      assistantMessage = `${preview}.\n\nPlease confirm: Yes / No / Edit.`;
      
      // Store the function call for later execution
      functionResults = {
        function_call: functionCall,
        preview_mode: true
      };
    }

    // Store the interaction for context memory
    if (userId) {
      try {
        await supabaseClient
          .from('ai_interactions')
          .insert({
            user_id: userId,
            message,
            response: assistantMessage,
            context_data: {
              context: context || [],
              function_results: functionResults,
              mode: shouldPreview ? 'preview' : shouldCommit ? 'commit' : 'conversation'
            }
          });
      } catch (error) {
        console.error('Error storing interaction:', error);
      }
    }

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      function_results: functionResults,
      mode: shouldPreview ? 'preview' : shouldCommit ? 'commit' : 'conversation',
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