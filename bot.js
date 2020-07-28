require('dotenv').config();
const createCsvParser = require('csv-parser');
const fs = require('fs');
var handlebars = require('express-handlebars').create({ defaultLayout: 'main' });
var express = require('express');
var app = require('express')();
const http = require('http').createServer(app);
var io = require('socket.io')(http);

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
var question = '';
var answer = '';

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
  renderWebsite();
  init(); // parce csv, prep database, connect to twitch
});

async function init() {
  var questionArr = parseCsv(CSV_FILE);
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
    `user` varchar(120) NOT NULL, \
    `score` tinyint(4) NOT NULL, \
    PRIMARY KEY (`user`) \
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
  console.log("All questions loaded into database.");
}

function onConnectedHandler(address, port) {
  client.action(channel, "bot has connected");
  askQuestion();
}

async function askQuestion() {
  chooseQuestion();
  await delay(1000);
  sendQuestion();
}

async function chooseQuestion() {
  // say bye if all questions in databade have been asked
  if (askedQuestionIds.length === total) {
    client.action(channel, "Those are all the questions, thanks for playing!");
    question = '';
    return;
  }
  // choosing question that has not yet been asked
  var added = false;
  while (!(added)) {
    var i = Math.floor(Math.random() * total) + 1;
    if (!(askedQuestionIds.includes(i))) {
      askedQuestionIds.push(i);
      added = true;
    }
  }
  console.log("askedQuestionIds", askedQuestionIds);
  var sql = `SELECT * FROM questions WHERE qid = ${i}`;
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
    question = result[0].question;
    answer = result[0].answer;
  });
}

function sendQuestion() {
  if (!(question === '')) {
    client.action(channel, `Question #${askedQuestionIds.length} of ${total}: ${question}`);
  }
}

function checkAnswer(user, message) {
  if (message.toLowerCase() === answer.toLowerCase()) {
    var username = user["display-name"] || user["username"];
    client.action(channel, `${username} guessed the correct answer: ${answer}`);
    addToLeaderboard(username);
    askQuestion();
  }
}

function addToLeaderboard(username) {
  var sql = `INSERT INTO leaderboard (user, score) VALUES ('${username}', 1) ON DUPLICATE KEY UPDATE score = score + 1`;
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
  });
}



// -------------------------

function renderWebsite() {
  app.engine('handlebars', handlebars.engine)
  app.set('view engine', 'handlebars');
  app.use(express.static(__dirname + '/static'));
  app.get('/', function (req, res) {
    res.render('index', {
      layout: 'main',
      question: question
      // prevQ: prevQ,
      // prevA: prevA
    });
  });
  http.listen(8000, () => {
    console.log("listening on port 8000");
    io.on('connection', function (socket) { // Notify for a new connection and pass the socket as parameter.
      console.log('socket connected');
    });
  });
}

setInterval(function () {
  io.emit('current', question); // Emit on the opened socket.
}, 1000);

setInterval(function () {
  if (askedQuestionIds.length > 1) {
    var sql = `SELECT question, answer FROM questions WHERE qid = ${askedQuestionIds[askedQuestionIds.length - 1]}`;
    connection.query(sql, function(err, result) {
      if (err) {
        return console.error('*** error: ' + err.message);
      }
      var prevQ = result[0].question;
      var prevA = result[0].answer;
      io.emit('previous', prevQ, prevA);
    });
  }
}, 5000);
