const mysql = require('mysql2');

const connectionUri = 'mysql://3pKNE13aBCdrgSj.root:AIzaSyD6zAaqEbBjW4M5FLtEEg1Ndh-qj90g7bQ@gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com:4000/sys';

const connection = mysql.createConnection({
  uri: connectionUri,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

connection.connect((err) => {
  if (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
  console.log('Connected successfully to TiDB Cloud!');
  
  connection.query('SELECT 1 + 1 AS solution', (err, results) => {
    if (err) {
      console.error('Query failed:', err);
    } else {
      console.log('Query result:', results);
    }
    connection.end();
  });
});
