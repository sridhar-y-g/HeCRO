# Helium — Shopify CRO Opportunity Engine

Helium is a premium, developer-oriented Conversion Rate Optimization (CRO) audit and experimentation tool for Shopify brands. It uses live site evidence to scan collections, catalog layouts, product pages (PDPs), cart drawers, and checkout experiences, prioritizes conversion opportunities using the ICE framework, and autogenerates detailed A/B test briefs.

Helium features a tactile, premium **Neumorphic Soft UI** styling, a marketing landing page explaining the system architecture, and integrations with the **Jina Reader API**, **Gemini 2.5 Flash**, and **TiDB Cloud (MySQL)** with automatic local JSON database fallback.

---

## Features & Capabilities

*   **Marketing Hero & Interactive Floating Engine:** A sleek visual landing page highlighting Helium's value proposition and core engineering blocks.
*   **Tactical Scraper (Jina Reader API)**: Pulls clean plain-text representations of any Shopify site, bypassing popups, cookie walls, and heavy scripts.
*   **AI Engine (Gemini 2.5 Flash)**: Matches scraped brand data against professional e-commerce patterns to generate exactly 3 prioritized CRO issues backed by specific site text evidence.
*   **ICE Prioritization Framework**: Dynamically calculates Impact, Confidence, and Effort scores for each issue:
    $$\text{ICE Score} = \frac{\text{Impact} + \text{Confidence} + (11 - \text{Effort})}{3}$$
*   **Competitor Comparison Analysis**: Allows entering an optional competitor URL to baseline marketing patterns, price points, and layout advantages.
*   **A/B Test Experiment Briefs**: Generates A/B test setups (hypotheses, control details, variant mockups, tracking events, developer difficulty) with one-click clipboard copying.
*   **Manual Entry Fallback Panel**: Displays a manual text input area if a store is blocked by cloud scrapers, keeping the tool functional.
*   **TiDB Cloud Database Integration**: Features connection pooling with automated schema setup.
*   **Graceful JSON Fallback**: If the database connection fails, is offline, or is unconfigured, the app falls back to staging records in local JSON storage (`data/activities.json`).

---

## Tech Stack

*   **Frontend**: Vanilla HTML5, Vanilla CSS3 (Neumorphic System with Inter and Plus Jakarta Sans typography, backdrop blurs, and glassmorphism), and Vanilla JavaScript.
*   **Backend**: Node.js & Express.
*   **Database**: TiDB Cloud (MySQL Serverless) using connection pooling with `mysql2/promise`.
*   **AI Integrations**: Gemini 2.5 Flash API & Jina Reader Scraping API.

---

## Database Architecture

Helium initializes and manages an `activities` table inside the configured database (by default `/test` on your cluster):

```sql
CREATE TABLE IF NOT EXISTS activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  competitor_url VARCHAR(255),
  brand_name VARCHAR(255) NOT NULL,
  grade VARCHAR(10) NOT NULL,
  summary TEXT NOT NULL,
  report JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Local Setup & Development

### 1. Prerequisites
*   Node.js (v18 or higher recommended)
*   npm

### 2. Installation
Clone the repository, enter the directory, and install dependencies:
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
JINA_API_KEY=your_jina_reader_api_key
GEMINI_API_KEY=your_gemini_api_key

# TiDB Cloud Database Connection String (Use /test schema)
DATABASE_URL=mysql://<username>:<password>@<host>:4000/test
```
*Note: If `DATABASE_URL` contains the `<PASSWORD>` placeholder or is left empty, the server automatically boots into local JSON database fallback mode.*

### 4. Running Locally
Start the server in development mode:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## Hosting on Render (Web Service)

Follow these settings to host the application on Render:

1.  **Repository**: Connect your GitHub repository.
2.  **Settings**:
    *   **Root Directory**: Leave blank (repository root).
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node server.js`
3.  **Environment Variables**:
    Under the **Environment** tab, click **Add Environment Variable** and specify:
    *   `PORT` = `3000`
    *   `JINA_API_KEY` = *[Your API Key]*
    *   `GEMINI_API_KEY` = *[Your API Key]*
    *   `DATABASE_URL` = `mysql://<username>:<password>@<host>:4000/test`
4.  **Save changes** and Render will trigger the live build.
