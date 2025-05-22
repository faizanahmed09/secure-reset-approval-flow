
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { clientId, clientSecret, tenantId } = await req.json();
    
    // Validate inputs
    if (!clientId || !clientSecret || !tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get token from Azure AD
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const formData = new URLSearchParams();
    formData.append('client_id', clientId);
    formData.append('scope', 'https://graph.microsoft.com/.default');
    formData.append('client_secret', clientSecret);
    formData.append('grant_type', 'client_credentials');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure AD token error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Azure AD", details: errorText }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const data = await response.json();
    
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create a Supabase client
    const supabaseUrl = "https://lbyvutzdimidlzgbjstz.supabase.co";
    const supabaseKey = req.headers.get('apikey') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from the JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed", details: userError }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Store the credentials and token in the database
    const { error: insertError } = await supabase
      .from('azure_credentials')
      .upsert({
        user_id: user.id,
        client_id: clientId,
        client_secret: clientSecret,
        tenant_id: tenantId,
        token: data.access_token,
        token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }, { onConflict: 'user_id' });
    
    if (insertError) {
      console.error("Supabase error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store credentials", details: insertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Return the token and expiration
    return new Response(
      JSON.stringify({
        message: "Authentication successful",
        token: data.access_token,
        expiresIn: data.expires_in,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
