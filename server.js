const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const JINA_KEY = process.env.JINA_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!JINA_KEY || !GEMINI_KEY) {
  console.warn('WARNING: Missing JINA_API_KEY or GEMINI_API_KEY in the environment environment variables.');
}


app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const db = require('./db');

/**
 * Function 1: The Reader Function
 * Scrapes a website using Jina Reader API
 */
async function scrapeSite(url) {
  console.log(`[F1] Scraping site via Jina: ${url}`);
  try {
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${JINA_KEY}`,
        'X-No-Cache': 'true' // request fresh representation
      }
    });

    if (!response.ok) {
      throw new Error(`Jina API returned status ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Jina returned empty content');
    }

    console.log(`[F1] Scrape successful. Scraped ${text.length} characters.`);
    return text;
  } catch (err) {
    console.error(`[F1] Scrape failed for ${url}:`, err.message);
    throw err;
  }
}

/**
 * Function 2: The AI Processing Function
 * Sends store text to Gemini and gets a structured conversion analysis
 */
async function analyzeStoreText(storeText, storeUrl, competitorUrl = '') {
  console.log('[F2] Sending store text to Gemini for CRO Audit...');
  
  let competitorPrompt = '';
  if (competitorUrl) {
    competitorPrompt = `The user also provided a competitor: ${competitorUrl}. Compare the store's current experience against this competitor or other standard competitor practices. Highlight comparison in the competitorComparison field.`;
  }

  const prompt = `
You are Helium, an elite Shopify Conversion Rate Optimization (CRO) consultant.
Analyze the following text scraped from the Shopify brand website (${storeUrl}).

--- WEBSITE CONTENT ---
${storeText.substring(0, 18000)} // truncate to fit limits nicely
--- END WEBSITE CONTENT ---

${competitorPrompt}

Identify exactly 3 distinct conversion rate issues across these categories: catalog, collections, PDPs, cart, and merchandising.
Focus on real site/catalog evidence found in the text, not generic advice (e.g. mention specific product names, copy issues, hidden cart details, bundle setups, checkout flow, or navigation issues found in the text).

For each issue, you must calculate:
- Impact: 1 to 10 (potential conversion increase)
- Confidence: 1 to 10 (how sure we are that this will work)
- Effort: 1 to 10 (development difficulty, 1 = super easy, 10 = extremely hard)
- iceScore: A single decimal score calculated exactly using the formula: (Impact + Confidence + (11 - Effort)) / 3. Round to 1 decimal place.

Return your response strictly as a JSON object matching this schema:
{
  "brandName": "Name of the brand (e.g. Beardo)",
  "grade": "Conversion Grade (e.g., A, B, C, D, F) based on current text content issues",
  "summary": "A 1-2 sentence high-level summary of the store's biggest CRO opportunities.",
  "issues": [
    {
      "priority": "High" or "Medium" or "Low" (determined by iceScore: High >= 7.5, Medium 5.0-7.4, Low < 5.0),
      "category": "e.g., Product Page (PDP), Cart / Checkout, Homepage Catalog, Collections, Merchandising",
      "problem": "Clear, punchy sentence explaining the conversion issue.",
      "evidence": "Specific evidence based on the scraped text (e.g., mention actual button copy, layout structure, product details, or absence of elements).",
      "recommendation": "Exact, actionable instructions to fix the issue.",
      "impact": 9, // integer 1-10
      "confidence": 8, // integer 1-10
      "effort": 2, // integer 1-10
      "iceScore": 8.3, // float computed by (Impact + Confidence + (11 - Effort)) / 3
      "competitorComparison": "How this compare against the competitor or best practices. Mention the competitor brand name if provided.",
      "brief": {
        "title": "A/B Test Title (e.g. Sticky mobile 'Add to Cart' button)",
        "hypothesis": "If we implement [recommendation], then [primary metric] will increase by [X]% because [reason based on user behavior].",
        "control": "Details of the current setup (Control A).",
        "variant": "Details of the proposed design/layout setup (Variant B).",
        "metric": "Primary metric tracking event name (e.g., click_add_to_cart_total, checkout_started).",
        "devTime": "Estimated developer effort time (e.g., 2 hours, 1 day, 3 days)."
      }
    }
  ]
}

Sort the issues array by iceScore in descending order (highest score first).
Do not output any markdown code fences, backticks, or text outside the JSON object. Return raw valid JSON only.
`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const result = await response.json();
    let responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Gemini API returned an empty response');
    }

    responseText = responseText.trim();
    // Parse to ensure valid JSON
    const reportData = JSON.parse(responseText);
    console.log('[F2] AI Analysis complete.');
    return reportData;
  } catch (err) {
    console.error('[F2] Gemini call failed:', err);
    throw err;
  }
}

/**
 * Function 3: The Handler/Route Function
 * Handles the main workflow: scrapes, processes with AI, saves activity, returns results
 */
app.post('/api/audit', async (req, res) => {
  const { url, competitorUrl, manualText } = req.body;

  if (!url && !manualText) {
    return res.status(400).json({ error: 'Missing URL or manual text input.' });
  }

  try {
    let storeText = '';
    let isManual = false;

    // Step 1: Data Gathering (Reader Function)
    if (manualText && manualText.trim().length > 0) {
      storeText = manualText;
      isManual = true;
    } else {
      try {
        storeText = await scrapeSite(url);
      } catch (scrapeErr) {
        // Return a specific code so the frontend can trigger the elegant manual backup view
        return res.status(422).json({
          error: 'SCRAPE_BLOCKED',
          message: 'Failed to scrape the website automatically. Please paste the website homepage or product page text below instead.'
        });
      }
    }

    // Step 2: AI Processing Function
    const report = await analyzeStoreText(storeText, url || 'Manually Pasted Text', competitorUrl);

    // Validate report format
    if (!report.issues || !Array.isArray(report.issues)) {
      throw new Error('Gemini returned an invalid report structure');
    }

    // Step 3: Handler/Route Function (saving and routing)
    const auditId = Date.now().toString();
    const newActivity = {
      id: auditId,
      timestamp: new Date().toISOString(),
      url: url || 'Manual Input',
      competitorUrl: competitorUrl || '',
      brandName: report.brandName || 'Store Analysis',
      grade: report.grade || 'B',
      summary: report.summary || '',
      report: report
    };

    // Save to database (TiDB/MySQL or local JSON fallback)
    await db.saveActivity(newActivity);

    console.log(`[F3] Saved audit activity for ${newActivity.brandName}`);
    return res.json(newActivity);

  } catch (err) {
    console.error('[F3] Error in /api/audit route:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'An error occurred during AI analysis. Please try again.',
      details: err.message
    });
  }
});

// Endpoint to fetch audit history
app.get('/api/history', async (req, res) => {
  try {
    const history = await db.getHistory();
    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Helium CRO Engine running at http://localhost:${PORT} `);
  console.log(`==================================================`);
});
