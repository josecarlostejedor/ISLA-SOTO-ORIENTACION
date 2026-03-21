import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;
  console.log("Received submission data in Vercel function:", data);
  
  // Check for both VITE_ and non-VITE_ versions of the secret
  const GOOGLE_SCRIPT_URL = process.env.VITE_GOOGLE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL;

  if (!GOOGLE_SCRIPT_URL) {
    console.error("Google Sheets URL is NOT set in environment variables.");
    return res.status(400).json({ 
      success: false, 
      error: "Google Sheets URL missing. Please add VITE_GOOGLE_SCRIPT_URL to your Vercel Environment Variables." 
    });
  }

  console.log("Attempting to send data to Google Script URL from Vercel...");

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    
    const responseText = await response.text();
    console.log("Google Script response status:", response.status);
    
    res.json({ success: true, status: response.status, details: responseText });
  } catch (error) {
    console.error("Error submitting to Google Sheets:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to connect to Google Sheets script",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
