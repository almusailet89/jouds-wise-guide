import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        .from('financial_data')
        .insert({
          user_id: userId,
          type: parsedArgs.type,
          amount: parsedArgs.amount,
          currency: parsedArgs.currency,
          category: parsedArgs.category || null,
          note: parsedArgs.description || null,
          label: parsedArgs.category || parsedArgs.type,
          date: parsedArgs.date || new Date().toISOString()
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
    const {
      message,
      context,
      mode,
      pendingFunction,
      voice_mode = false,   // true = Majlis Mode — brevity enforced, Saudi dialect
      detected_language = "ar", // "ar" | "en" | "mixed" — from whisper-transcribe
    } = await req.json();
    
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

    // ── Tiered Model Routing ───────────────────────────────────────────────────
    // Simple queries → gpt-4o-mini (80% cheaper, fast)
    // Complex finance/planning/voice → GPT-5 (full reasoning power)
    const SIMPLE_PATTERNS = [
      /كم الساعة|what time|prayer|صلاة|الفجر|الظهر|العصر|المغرب|العشاء/i,
      /weather|الطقس|درجة الحرارة/i,
      /كيف حال|how are you|مرحبا|hello|هلا/i,
      /شكراً|thank you|ok|تمام|ماشي/i,
    ];
    const isSimpleQuery = !voice_mode && SIMPLE_PATTERNS.some(p => p.test(message));
    const selectedModel = isSimpleQuery
      ? "gpt-4o-mini"        // Fast + cheap for simple lookups
      : "gpt-5-2025-08-07";  // Full reasoning for finance, planning, voice

    // ── Bilingual response language ───────────────────────────────────────────
    // Respond in the same language the user spoke/typed
    const respondInEnglish = detected_language === "en";
    const respondMixed     = detected_language === "mixed";

    // ── Detect "Jood, note this" trigger ─────────────────────────────────────
    const isActionMode = message.toLowerCase().startsWith('jood, note this');
    const shouldPreview = isActionMode && mode !== 'commit';
    const shouldCommit = isActionMode && mode === 'commit';
    const isConfirmation = ['yes', 'confirm', 'ok', 'sure', 'proceed'].includes(message.toLowerCase().trim());
    const isEdit = message.toLowerCase().includes('edit');
    const isCancel = ['no', 'cancel', 'nevermind'].includes(message.toLowerCase().trim());

    // ── Saudi Dialect Voice System Prompt ────────────────────────────────────
    // This is the core identity layer — Blueprint slides 3, 4, 5, 10, 11, 18
    const JOOD_BASE_IDENTITY = `أنتِ جود — مساعدة تنفيذية سعودية ذكية متخصصة في التخطيط المالي وإدارة الحياة اليومية.

شخصيتك:
- هادئة، واثقة، احترافية — مع دفء حقيقي وإنسانية
- تشعرين بالأصالة السعودية — لستِ روبوتاً ولا مساعدة عامة
- ذكية على مستوى تنفيذي — واضحة وحاسمة وغير مُطوِّلة
- تفهمين اللهجة السعودية الدارجة وتتجاوبين معها طبيعياً

لغتك:
- تكلمي بالعربية السعودية الطبيعية — ليس الفصحى الرسمية
- قبولي للكلمات الدارجة: بكرة، الحين، زين، مصاريف، تمام، وش، أبي
- عند الرد بالإنجليزية: احتفظي بنفس الشخصية الهادئة والاحترافية
- إذا تحدث المستخدم بمزيج عربي-إنجليزي، رديّ بنفس المزيج بشكل طبيعي

السياق السعودي:
- تفهمين التقويم الهجري، أوقات الصلاة، الزكاة، رمضان
- تعرفين الريال السعودي، تداول، أرامكو، سوق المال السعودي
- تعرفين رواتب القطاع الحكومي ومستوى المعيشة في المملكة
- تحترمين القيم الثقافية والدينية في كل ردودك

${userContext ? `بيانات المستخدم: ${userContext}` : ""}`;

    // ── Response format rules ────────────────────────────────────────────────
    // Voice mode (Majlis): Answer + Insight + Next Action ≤ 15 words each
    // Text mode: richer markdown responses allowed
    const VOICE_RULES = voice_mode ? `
قواعد الرد الصوتي — اتبعيها بدقة:
1. الجواب: جملة واحدة واضحة (≤ 15 كلمة)
2. الفائدة: معلومة مفيدة قصيرة (≤ 12 كلمة)
3. الإجراء التالي: سؤال أو اقتراح عملي (≤ 12 كلمة)

مثال ممتاز على الرد الصوتي:
المستخدم: "كم صرفت هذا الأسبوع؟"
جود: "حوالي ١٢٠٠ ريال. أغلبها مطاعم. تحب أعطيك التفاصيل؟"

ممنوع في الوضع الصوتي:
❌ لا قوائم (bullets)
❌ لا عناوين أو markdown
❌ لا ردود تتجاوز 50 كلمة
❌ لا تكرار للسؤال

الردود الصوتية يجب أن تُقرأ بصوت عالٍ بشكل طبيعي.` : `
في وضع النص: يمكنكِ استخدام markdown، قوائم، وأرقام. اجعلي الردود غنية ومفيدة ومنظمة.`;

    const LANGUAGE_RULE = respondInEnglish
      ? "\n\nIMPORTANT: The user is speaking English. Respond fully in English, maintaining the same calm Saudi executive AI persona."
      : respondMixed
      ? "\n\nالمستخدم يمزج العربية والإنجليزية. رديّ بنفس المزيج بشكل طبيعي — هذا ليس خطأ، هذا أسلوبه."
      : "";

    let systemPrompt = JOOD_BASE_IDENTITY + VOICE_RULES + LANGUAGE_RULE;

    if (shouldPreview) {
      systemPrompt += `

المستخدم قال "Jood, note this" — يريد منكِ تسجيل شيء. اتبعي الخطوات التالية:
1. استخدمي أدوات function calling لتحليل الطلب
2. ردّي بـ: "سأسجّل هذا: [ملخص طبيعي]"
3. اعرضي ملخصاً واضحاً لما سيُحفظ
4. اختمي بـ: "تأكيدي؟ نعم / لا / تعديل"

لا تُنفّذي أي حفظ في قاعدة البيانات الآن — هذا وضع المعاينة فقط.`;

    } else if (shouldCommit || (isConfirmation && pendingFunction)) {
      systemPrompt += `

المستخدم أكّد. نفّذي function call الآن واردّي بـ "تمام، تم الحفظ." مع تأكيد مختصر لما حُفظ.`;

    } else if (isCancel) {
      systemPrompt += `

المستخدم ألغى الطلب. ردّي بلطف أنكِ لن تسجّلي شيئاً وتابعي المحادثة.`;

    } else {
      systemPrompt += `

تكلّمي مع المستخدم كمساعدة شخصية ذكية. لا تُنفّذي أي إجراءات في قاعدة البيانات إلا عند قول "Jood, note this" أو ما يماثله.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context || []),
      { role: 'user', content: message }
    ];

    const requestBody: any = {
      model: selectedModel,
      messages: messages,
      // Voice mode: short responses needed → fewer tokens → lower cost
      max_completion_tokens: voice_mode ? 200 : 1000,
      stream: false,
    };

    // Enable function calling for action mode or commit with pending function
    if (shouldPreview || (shouldCommit && pendingFunction)) {
      requestBody.tools = functionTools;
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
    let functionResults = null;

    // Handle cancellation
    if (isCancel) {
      assistantMessage = "Understood — I won't record that. Is there anything else I can help you with?";
    }
    // Handle function calls for commit mode
    else if (choice.message.tool_calls && (shouldCommit || (isConfirmation && pendingFunction)) && userId) {
      try {
        const functionCall = choice.message.tool_calls[0].function || pendingFunction;
        const result = await executeFunction(functionCall, userId, supabaseClient);
        functionResults = result;
        assistantMessage = `Consider it done. ${result}`;
      } catch (error) {
        console.error('Function execution error:', error);
        assistantMessage = `I encountered an error while trying to save that information: ${error.message}. Please try again.`;
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

    // ── Emotion detection for ElevenLabs voice_settings ──────────────────────
    // Heuristic: pick the right ElevenLabs emotion based on content
    const emotionHints: [RegExp, string][] = [
      [/متوتر|ضغط|قلق|خايف|stressed|worried/i,                  "empathetic"],
      [/ممتاز|رائع|تهانينا|great|excellent|congratulations/i,    "warm"],
      [/استثمار|محفظة|تحليل|مخاطر|invest|portfolio|analysis/i,   "confident"],
    ];
    let suggestedEmotion = "neutral";
    for (const [pattern, emo] of emotionHints) {
      if (pattern.test(assistantMessage)) { suggestedEmotion = emo; break; }
    }

    return new Response(JSON.stringify({
      message: assistantMessage,
      function_results: functionResults,
      mode: shouldPreview ? 'preview' : shouldCommit ? 'commit' : 'conversation',
      voice_mode,
      detected_language,
      suggested_emotion: suggestedEmotion,   // Used by frontend to pick ElevenLabs settings
      model_used: selectedModel,
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