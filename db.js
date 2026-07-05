const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const jsonFilePath = path.join(__dirname, 'data', 'activities.json');

// Helper to ensure JSON data dir exists
function ensureDataDir() {
  const dir = path.dirname(jsonFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let pool = null;
let useMySQL = false;

async function initDB() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes('<PASSWORD>')) {
    try {
      console.log('Attempting to connect to TiDB Cloud database...');
      
      // Parse database URL to enable SSL automatically
      pool = mysql.createPool({
        uri: dbUrl,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true // TiDB Cloud requires SSL
        }
      });

      // Test connection
      const connection = await pool.getConnection();
      console.log('==================================================');
      console.log(' Successfully connected to TiDB Cloud database! ');
      console.log('==================================================');
      
      // Initialize activities table if it doesn't exist
      await connection.query(`
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
        )
      `);
      connection.release();
      useMySQL = true;
    } catch (err) {
      console.error('TiDB database connection failed:', err.message);
      console.log('Falling back to local JSON database (data/activities.json).');
      useMySQL = false;
    }
  } else {
    console.log('No database connection URL or placeholder password detected. Using local JSON database.');
    useMySQL = false;
  }
}

// Trigger database initialization
const initPromise = initDB();

async function getHistory() {
  await initPromise;
  if (useMySQL) {
    try {
      const [rows] = await pool.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 10');
      return rows.map(row => ({
        id: row.id.toString(),
        timestamp: row.timestamp,
        url: row.url,
        competitorUrl: row.competitor_url || '',
        brandName: row.brand_name,
        grade: row.grade,
        summary: row.summary,
        report: typeof row.report === 'string' ? JSON.parse(row.report) : row.report
      }));
    } catch (err) {
      console.error('Error fetching history from TiDB, falling back to JSON:', err.message);
    }
  }
  
  // JSON Fallback
  ensureDataDir();
  if (!fs.existsSync(jsonFilePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(jsonFilePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    return [];
  }
}

async function saveActivity(activity) {
  await initPromise;
  if (useMySQL) {
    try {
      const query = `
        INSERT INTO activities (timestamp, url, competitor_url, brand_name, grade, summary, report)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const reportStr = JSON.stringify(activity.report);
      await pool.query(query, [
        activity.timestamp,
        activity.url,
        activity.competitorUrl || null,
        activity.brandName,
        activity.grade,
        activity.summary,
        reportStr
      ]);
      console.log(`[DB] Saved activity for ${activity.brandName} to TiDB Cloud database.`);
      return;
    } catch (err) {
      console.error('Error saving activity to TiDB, falling back to JSON:', err.message);
    }
  }

  // JSON Fallback
  ensureDataDir();
  let history = [];
  if (fs.existsSync(jsonFilePath)) {
    try {
      history = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8') || '[]');
    } catch (e) {
      history = [];
    }
  }
  
  history.unshift(activity);
  fs.writeFileSync(jsonFilePath, JSON.stringify(history, null, 2), 'utf8');
  console.log(`[DB] Saved activity for ${activity.brandName} to local JSON file.`);
}

module.exports = {
  getHistory,
  saveActivity
};
