// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
console.log("Delete user function script started");
// Main function to handle user deletion requests
async function deleteUser(req) {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Extract parameters from the request body
    const { userId, adminEmail } = await req.json();
    if (!userId || !adminEmail) {
      return new Response(JSON.stringify({
        success: false,
        message: "User ID and admin email are required."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? '', Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '');
    // 1. Verify if the requesting user is an admin
    const { data: adminUser, error: adminError } = await supabaseAdmin.from('azure_users').select('role').eq('email', adminEmail).single();
    if (adminError || !adminUser) {
      throw new Error("Admin user not found or could not be verified.");
    }
    if (adminUser.role !== 'admin') {
      return new Response(JSON.stringify({
        success: false,
        message: "Unauthorized: Only admins can delete users."
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 2. Prevent admin from deleting themselves
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.from('azure_users').select('email').eq('id', userId).single();
    if (targetUserError || !targetUser) {
      throw new Error("Target user not found.");
    }
    if (targetUser.email === adminEmail) {
      return new Response(JSON.stringify({
        success: false,
        message: "Admins cannot delete their own accounts."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 3. Proceed with deletion
    const { error: deleteError } = await supabaseAdmin.from('azure_users').delete().eq('id', userId);
    if (deleteError) {
      throw new Error(`Database error: ${deleteError.message}`);
    }
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: "User deleted successfully."
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (err) {
    console.error("Error in deleteUser function:", err);
    return new Response(JSON.stringify({
      success: false,
      message: err.message || "An internal server error occurred."
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}
// Listen for incoming fetch events
Deno.serve(deleteUser);
