require('dotenv').config();
const createCsvParser = require('csv-parser');
const fs = require('fs');

const sqlFile = 'db.sql';
const csvFile = 'trivia.csv';

const tmi = require('tmi.js');
// twitch connection config
const options = {
  options: {
    debug: true,
  },
  identity: {
    username: process.env.TWITCH_USER,
    password: process.env.TWITCH_PASS,
  },
  channels: [process.env.CHANNEL],
};
const channel = process.env.CHANNEL;

const client = new tmi.client(options);
// client.connect();
client.on("connected", onConnectedHandler);
client.on("chat", onChatHandler);

const mysql = require('mysql');
var connection = mysql.createConnection({multipleStatements: true});
// database connection config
var connection = mysql.createConnection({
  host     : process.env.HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : 'triviabot'
});

connection.connect(function(err) {
  if (err) {
    return console.error('error: ' + err.message);
  }
  console.log('Connected to the MySQL server.');
  initializeDatabase(sqlFile);
  loadQuestions(csvFile);
});

function onConnectedHandler(address, port) {
  client.action(channel, "bot has connected");
}

function onChatHandler(channel, user, message, self) {
  if (self) {
    return;
  }
  checkAnswer(user, message);
}



function initializeDatabase(sqlFile) {
  const sqlStr = fs.readFileSync(sqlFile).toString();
  const sqlArr = sqlStr.toString().split(');');
  sqlArr.forEach(query => {
    if (query) {
      // Add the delimiter back to each query before you run them
      // In my case the it was `);`
      query += ");";
      // console.log(query);
      connection.query(query, function(err) {
        if (err) {
          return console.error('error: ' + err.message);
        }
      });
    }
  });
}

function loadQuestions(csvFile) {
  var questionSet = [];
  fs.createReadStream(csvFile)
    .pipe(createCsvParser())
    .on("data", (row) => {
      console.log(row);
      questionSet.push(row); //appends row to questionSet array
    })
    .on("end", () => {
      console.log("CSV file successfully processed");
    });
  var i;
  for (i = 0; i < questionSet.length; i++) {
    var q = questionSet[i]["question"];
    var a = questionSet[i]["answer"];
    var sql = "INSERT INTO questions(qid, question, answer) VALUES(${i}, ${q}, ${a})";
    connection.query(sql, function(err) {
      if (err) {
        return console.error('error: ' + err.message);
      }
    });
  }
  connection.end();
  console.log("All questions loaded into database")
}