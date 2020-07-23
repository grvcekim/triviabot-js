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
// client.connect();
client.on("connected", onConnectedHandler);
client.on("chat", onChatHandler);

var total = 0;
var askedQuestionIds = [];

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
  init(); // Parses CSV and preps the database
});

async function init() {
  var questionArr = parseCsv(CSV_FILE);
  console.log(questionArr);
  initializeDatabase();
  await delay(1000);
  loadDatabase(questionArr);
  await delay(1000);
  client.connect();
}

function delay(ms){
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  console.log(questionArr);
  for (let pair of questionArr) {
    // var pair = questionArr[i];
    // console.log(questionArr(pair));
    var q = pair.question;
    var a = pair.answer;
    // console.log("q", q);
    // console.log("a", a)
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
}

function onConnectedHandler(address, port) {
  client.action(channel, "bot has connected");
  chooseQuestion();
}

async function chooseQuestion() {
  console.log("in askQuestion");
  if (askedQuestionIds.length === total) {
    client.action(channel, "Those are all the questions, thanks for playing!");
    return;
  }
  var i = Math.floor(Math.random() * total) + 1;
  while (i in askedQuestionIds) {
    i = Math.floor(Math.random() * total) + 1;
  }
  console.log("i =", i);
  askedQuestionIds.push(i);
  console.log("askedQuestionIds", askedQuestionIds);
  var sql = `SELECT * FROM questions WHERE qid = ${i}`;
  var curr;
  // runloop = async () => {
  //   connection.query(sql, function(err, result) {
  //     if (err) {
  //       return console.error('*** error: ' + err.message);
  //     }
  //     console.log("result", result)
  //     curr = result[0];
  //     var q = curr.question;
  //     var a = curr.answer;
  //     await client.action(channel, `Question #${askedQuestionIds[askedQuestionIds.length - 1]} of ${total}: ${q}`);
  //   });
  // }
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
    console.log("result", result)
    curr = result[0];
    var q = curr.question;
    var a = curr.answer;
    client.action(channel, `Question #${askedQuestionIds[askedQuestionIds.length - 1]} of ${total}: ${q}`);
  });
  await console.log("curr", curr);
}

function askQuestion(curr) {
  var q = curr.question;
  var a = curr.answer;
  // client.action(channel, `Question #${askedQuestionIds[-1]} of ${total}: ${q}`);
}