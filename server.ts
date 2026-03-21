import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/submit-results", async (req, res) => {
    const data = req.body;
    console.log("Received submission data:", data);
    
    // Check for both VITE_ and non-VITE_ versions of the secret
    const GOOGLE_SCRIPT_URL = process.env.VITE_GOOGLE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_SCRIPT_URL) {
      console.error("Google Sheets URL is NOT set in environment variables (checked VITE_GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_URL).");
      return res.status(400).json({ 
        success: false, 
        error: "Google Sheets URL missing. Please add VITE_GOOGLE_SCRIPT_URL to your Secrets." 
      });
    }

    console.log("Attempting to send data to Google Script URL...");

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
      console.log("Google Script response body:", responseText);
      
      res.json({ success: true, status: response.status });
    } catch (error) {
      console.error("Error submitting to Google Sheets:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to connect to Google Sheets script",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
