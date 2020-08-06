require('dotenv').config();
const csv = require('csv-parser');
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
var askedQuestions = [];
var question = '';
var answer = '';

const mysql = require('mysql');
const { send } = require('process');
// database connection config
var connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : 'triviabot',
  port : process.env.DB_PORT,
  multipleStatements: true
});

// connect to database, start front-end, ready bot and database
connection.connect(function(err) {
  if (err) {
    return console.error('*** error: ' + err.message);
  }
  console.log('Connected to the MySQL server.');
  renderWebsite();
  init(); // parce csv, prep database, connect to twitch
});

// prepare the bot and database
async function init() {
  var questionArr = parseCsv(CSV_FILE);
  initializeDatabase();
  await delay(2000);
  loadDatabase(questionArr);
  await delay(2000);
  client.connect();
}

function delay(ms){
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ask question once bot has connected to twitch client
function onConnectedHandler(address, port) {
  client.action(channel, "bot has connected");
  askQuestion();
}

// check every message against current answer
function onChatHandler(channel, user, message, self) {
  if (self) {
    return;
  }
  if (message === '!question' || message === '!q') {
    sendQuestion();
  }
  if (message === '!help') {
    client.say(channel, `Enter !question or !q to get the current question. Enter !score to get your score.`);
  }
  if (message === '!score') {
    sendScore(user);
  }
  checkAnswer(user, message);
}

// create triviabot database, questions table, leaderboard table
function initializeDatabase() {
  var sql = "CREATE DATABASE IF NOT EXISTS `triviabot`; \
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
  CREATE TABLE IF NOT EXISTS `leaderboard` ( \
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

// parse csv for question and answer pairs separated by : and store them in questionArr
function parseCsv(CSV_FILE) {
  var questionArr = [];
  fs.createReadStream(CSV_FILE)
    .pipe(csv({ separator: ':' }))
    .on("data", (row) => {
      console.log(row);
      questionArr.push(row); // appends row to questionArr array
    })
    .on("end", () => {
      console.log("CSV file successfully processed.");
    });
  return questionArr;
}

// load database with questions parsed from csv file
function loadDatabase(questionArr) {
  console.log(questionArr);
  for (let pair of questionArr) {
    var q = pair.question;
    var a = pair.answer;
    var sql = `INSERT INTO questions (question, answer) VALUES ("${q}", "${a}")`;
    connection.query(sql, function(err) {
      if (err) {
        return console.error('*** error: ' + err.message);
      }
    });
  }
  // update total variable with total number of questions loaded into database
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

// choose and ask new question
async function askQuestion() {
  chooseQuestion();
  await delay(1000);
  sendQuestion();
}

// choose question
async function chooseQuestion() {
  // empty list of askedQuestionIds when all questions have been asked to restart
  if (askedQuestionIds.length === total) {
    askedQuestionIds = [];
  }
  // choose question that has not yet been asked and add to askedQuestionIds
  var added = false;
  while (!(added)) {
    var i = Math.floor(Math.random() * total) + 1;
    if (!(askedQuestionIds.includes(i))) {
      askedQuestionIds.unshift(i);
      added = true;
    }
  }
  // query chosen question from database
  console.log("askedQuestionIds", askedQuestionIds);
  var sql = `SELECT * FROM questions WHERE qid = ${i}`;
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
    // insert question into beginning of list of askedQuestions
    askedQuestions.unshift(result[0]);
    // update current question, answer variables
    question = result[0].question;
    answer = result[0].answer;
  });
  // keep askedQuestions from getting too big
  if (askedQuestions.legnth > 10) {
    askedQuestions.pop();
  }
}

// send current question to twitch chat and front-end
function sendQuestion() {
  if (!(question === '')) {
    client.say(channel, `Question: ${question}`);
    io.emit('current', question);
  }
}

function sendScore(user) {
  var username = user["display-name"] || user["username"];
  var sql = `SELECT score FROM leaderboard WHERE user = "${username}"`;
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
    var score;
    if (result.length == 0) {
      score = 0;
    } else {
      score = result[0].score;
    }
    if (score == 1) {
      client.say(channel, `${username} has ${score} point`);
    } else {
      client.say(channel, `${username} has ${score} points`);
    }
  });
}

// check message with current answer
// if answer is correct, update user's score in leaderboard (addToLeaderboard), update leaderboard in front-end (updateLeaderboard),
// update asked questions in front-end (updatePreviousQestion), choose new question (askQuestion)
function checkAnswer(user, message) {
  if (message.toLowerCase() === answer.toLowerCase()) {
    var username = user["display-name"] || user["username"];
    client.say(channel, `${username} guessed the correct answer: ${answer}`);
    addToLeaderboard(username);
    updateLeaderboard();
    updatePreviousQuestions();
    askQuestion();
  }
}

// increment user's score or adds user to leaderboard database when question is correctly answered
function addToLeaderboard(username) {
  var sql = `INSERT INTO leaderboard (user, score) VALUES ("${username}", 1) ON DUPLICATE KEY UPDATE score = score + 1`;
  connection.query(sql, function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
  });
}

// send updated leaderboard to front-end
function updateLeaderboard() {
  connection.query("SELECT * FROM leaderboard ORDER BY score DESC", function(err, result) {
    if (err) {
      return console.error('*** error: ' + err.message);
    }
    io.emit('leaderboard', result);
  });
}

// send updated previous questions to front-end
function updatePreviousQuestions() {
  io.emit('previous', askedQuestions)
}

// connect to front-end
function renderWebsite() {
  app.engine('handlebars', handlebars.engine);
  app.set('view engine', 'handlebars');
  app.use(express.static(__dirname + '/static'));
  app.get('/', function(req, res) {
    res.render('index', {
      layout: 'main',
    });
  });
  http.listen(8000, () => {
    console.log("listening on port 8000");
  });
}

io.on('connection', function(socket) {
  if (askedQuestions.length > 0 && askedQuestions[0].question === question) {
    io.emit('previous', askedQuestions.slice(1));
  } else {
    io.emit('previous', askedQuestions);
  }
  updateLeaderboard();
  io.emit('current', question);
});