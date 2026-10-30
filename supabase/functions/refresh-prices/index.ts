import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { checkAndIncrementRateLimit, getPlanTier } from "../_shared/rate-limit.ts";

// Refreshes current_price for the CALLER's own stock/crypto holdings only.
//
// Auth is enforced here (supabase.auth.getUser), not by the gateway: the function is
// deployed with verify_jwt = false because the public anon key already passes the
// gateway's JWT check, so that check added nothing — while a gateway 401 has no CORS
// headers and surfaces in the browser as an opaque CORS failure.
//
// Prices are only ever written from a real quote. Holdings with no reliable free source
// (Tadawul and other stocks today) are left untouched and reported back as skipped.

// Common tickers → CoinGecko coin ids. Unknown tickers are skipped, never guessed.
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  TON: "the-open-network",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  SHIB: "shiba-inu",
  XLM: "stellar",
  ATOM: "cosmos",
  UNI: "uniswap",
};

// Quote currencies CoinGecko supports that holdings in this app actually use.
const SUPPORTED_VS_CURRENCIES = new Set(["sar", "usd", "aed", "kwd", "bhd", "eur", "gbp"]);

type SkipReason =
  | "tadawul_no_price_source"
  | "stock_no_price_source"
  | "unknown_crypto_ticker"
  | "unsupported_currency"
  | "price_unavailable"
  | "update_failed";

interface Holding {
  id: string;
  symbol: string | null;
  asset_type: string | null;
  market: string | null;
  currency: string | null;
  is_crypto: boolean | null;
}

const json = (body: unknown, status: number, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" },
    });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "method_not_allowed" }, 405, corsHeaders);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ success: false, error: "unauthorized" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // User-scoped client: every holdings read/write also goes through RLS.
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Rejects the anon key and any non-user token — only a real session passes.
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return json({ success: false, error: "unauthorized" }, 401, corsHeaders);
    }

    // endpoint_rate_limits is service-role-only under RLS, so the counter needs the
    // service client. It is used for nothing else and always scoped to user.id.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { isAdmin, isSignature } = await getPlanTier(admin, user.id);
    if (!isAdmin) {
      const limit = isSignature ? 30 : 10;
      const rl = await checkAndIncrementRateLimit(admin, user.id, "refresh-prices", limit);
      if (rl.limited) {
        return json({
          success: false,
          error: "rate_limited",
          message: `تجاوزتِ حد ${limit} تحديثات للأسعار في الساعة. يُعاد التعيين بداية الساعة التالية.`,
          limit: rl.limit, used: rl.used, resets_at: rl.resetsAt,
        }, 429, corsHeaders);
      }
    }

    const { data: holdings, error: holdingsError } = await supabase
      .from("portfolio_holdings")
      .select("id, symbol, asset_type, market, currency, is_crypto")
      .eq("user_id", user.id)
      .in("asset_type", ["stock", "crypto"]);
    if (holdingsError) throw holdingsError;

    const skipped: { id: string; symbol: string; reason: SkipReason }[] = [];
    const cryptoTargets: { holding: Holding; symbol: string; coinId: string; vs: string }[] = [];

    for (const holding of (holdings ?? []) as Holding[]) {
      const symbol = (holding.symbol ?? "").trim().toUpperCase();
      const isCrypto = holding.asset_type === "crypto" || holding.is_crypto === true;

      if (!isCrypto) {
        const reason = (holding.market ?? "").toLowerCase() === "tadawul"
          ? "tadawul_no_price_source"
          : "stock_no_price_source";
        skipped.push({ id: holding.id, symbol, reason });
        continue;
      }

      const coinId = COINGECKO_IDS[symbol];
      if (!coinId) {
        skipped.push({ id: holding.id, symbol, reason: "unknown_crypto_ticker" });
        continue;
      }

      const vs = (holding.currency ?? "USD").trim().toLowerCase();
      if (!SUPPORTED_VS_CURRENCIES.has(vs)) {
        skipped.push({ id: holding.id, symbol, reason: "unsupported_currency" });
        continue;
      }

      cryptoTargets.push({ holding, symbol, coinId, vs });
    }

    // One batched quote request for all of this user's crypto holdings.
    let quotes: Record<string, Record<string, number>> = {};
    if (cryptoTargets.length > 0) {
      const ids = [...new Set(cryptoTargets.map((t) => t.coinId))].join(",");
      const vsList = [...new Set(cryptoTargets.map((t) => t.vs))].join(",");
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vsList)}`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
        );
        if (res.ok) {
          quotes = await res.json();
        } else {
          console.error(`CoinGecko responded ${res.status}`);
        }
      } catch (error) {
        console.error("CoinGecko request failed:", error);
      }
    }

    const updated: { id: string; symbol: string; price: number; currency: string }[] = [];
    const now = new Date().toISOString();

    for (const { holding, symbol, coinId, vs } of cryptoTargets) {
      const price = Number(quotes?.[coinId]?.[vs]);
      if (!Number.isFinite(price) || price <= 0) {
        skipped.push({ id: holding.id, symbol, reason: "price_unavailable" });
        continue;
      }

      const { error: updateError } = await supabase
        .from("portfolio_holdings")
        .update({ current_price: price, last_updated: now })
        .eq("id", holding.id)
        .eq("user_id", user.id);
      if (updateError) {
        console.error(`Error updating holding ${holding.id}:`, updateError);
        skipped.push({ id: holding.id, symbol, reason: "update_failed" });
        continue;
      }

      const currency = vs.toUpperCase();
      const { error: historyError } = await supabase.from("price_history").insert({
        user_id: user.id,
        symbol,
        asset_type: "crypto",
        price,
        currency,
      });
      if (historyError) {
        console.error(`Error logging history for ${symbol}:`, historyError);
      }

      updated.push({ id: holding.id, symbol, price, currency });
    }

    return json({
      success: true,
      updated_count: updated.length,
      skipped_count: skipped.length,
      updated,
      skipped,
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Error in refresh-prices function:", error);
    return json({ success: false, error: "refresh_failed" }, 500, corsHeaders);
  }
});
