require('dotenv').config();
const createCsvParser = require('csv-parser');
const fs = require('fs');

// const SQL_FILE = 'db.sql';
const CSV_FILE = 'trivia.csv';

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
client.connect();
client.on("connected", onConnectedHandler);
client.on("chat", onChatHandler);

var total = -1;
var askedQuestions = [];

const mysql = require('mysql');
// database connection config
var connection = mysql.createConnection({
  host     : process.env.HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : 'triviabot',
  multipleStatements: true
});

connection.connect(function(err) {
  if (err) {
    return console.error('*** error: ' + err.message);
  }
  console.log('Connected to the MySQL server.');
  initializeDatabase();
  var questionArr = parseCsv(CSV_FILE);
  loadDatabase(questionArr);
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

function initializeDatabase() {
  var sql = "DROP DATABASE IF EXISTS `triviabot`; \
  CREATE DATABASE `triviabot`; \
  USE `triviabot`; \
  SET NAMES utf8; \
  SET character_set_client = utf8mb4; \
  DROP TABLE IF EXISTS `questions`; \
  CREATE TABLE `questions` ( \
    `qid` tinyint(4) NOT NULL AUTO_INCREMENT, \
    `question` varchar(250) NOT NULL, \
    `answer` varchar(100) NOT NULL, \
    PRIMARY KEY (`qid`) \
  ); \
  DROP TABLE IF EXISTS `leaderboard`; \
  CREATE TABLE `leaderboard` ( \
    `user_hash` varchar(120) NOT NULL, \
    `score` tinyint(4) NOT NULL, \
    PRIMARY KEY (`user_hash`) \
  );";
  connection.query(sql, function(err) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
  });
  console.log("Database initialized.");
}

function parseCsv(CSV_FILE) {
  var questionArr = [];
  fs.createReadStream(CSV_FILE)
    .pipe(createCsvParser())
    .on("data", (row) => {
      console.log(row);
      questionArr.push(row); // appends row to questionArr array
    })
    .on("end", () => {
      console.log("CSV file successfully processed.");
    });
  return questionArr;
}

function loadDatabase(questionArr) {
  setTimeout(() => {
    for (let pair of questionArr) {
      var q = pair.question;
      var a = pair.answer;
      var sql = `INSERT INTO questions (question, answer) VALUES ('${q}', '${a}')`;
      connection.query(sql, function(err) {
        if (err) {
          return console.error('*** error: ' + err.message);
        }
      });
    }
    var sql = `SELECT * FROM questions`;
    connection.query(sql, function(err, result) {
      if (err) {
        return console.error('*** error: ' + err.message);
      }
      total = result.length;
      console.log("total", total);
    });
    // connection.end();
    console.log("All questions loaded into database.");
  }, 3000);
}

function onConnectedHandler(address, port) {
  client.action(channel, "bot has connected");
  askQuestion();
}

function askQuestion() {
  if (askedQuestions.length === total) {
    client.action(channel, "Those are all questions, thanks for playing!");
    return;
  }
  do {
    var i = Math.floor(Math.random() * total) + 1;
    console.log(total);
  }
  while (i in askedQuestions);
  askedQuestions.push(i);
  console.log("i =", i);
  var sql = `SELECT * FROM questions WHERE qid = ${i}`;
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
    console.log(result);
  });

  // question = questionSet[curr].question;
  // answer = questionSet[curr].answer;
  // curr = curr + 1;
  // client.action(channel, `Question #${curr} of ${questionSet.length}: ${question}`);
}