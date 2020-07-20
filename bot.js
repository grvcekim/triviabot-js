// username must be named a mod in the channel -> /mod <username> in channel's chat
require('dotenv').config();
const tmi = require('tmi.js');
const createCsvParser = require('csv-parser');
const mysql = require('mysql');
const fs = require('fs');
const http = require('http');
var express = require('express');
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
var md5 = require("md5");
var app = express();
var io = require('socket.io')(8000);

// Twitch connection config
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

var connection = mysql.createConnection({
  host     : process.env.HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : 'triviabot'
});

const channel = process.env.CHANNEL;
const file = "trivia.csv";
var curr = 0;
var questionSet = [];
var question = "foo";
var answer = "";

connection.connect(function(err) {
  if (err) {
    return console.error('error: ' + err.message);
  }
  console.log('Connected to the MySQL server.');
});

const client = new tmi.client(options);

client.connect();
loadQuestions(file);

client.on("connected", onConnectedHandler);
client.on("chat", onChatHandler);
renderWebsiteSOCKET();

function onConnectedHandler(address, port) {
  client.action(channel, "bot has connected");
  askQuestion();
}

function onChatHandler(channel, user, message, self) {
  if (self) {
    return;
  }
  checkAnswer(user, message);
}

function loadQuestions(file) {
  fs.createReadStream(file)
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
      var sql = `INSERT INTO questions(qid, question, answer)
                VALUES(${i}, ${q}, ${a})`;
      connection.query(sql, function(err) {
        if (err) {
          return console.error('error: ' + err.message);
        }
    });
    connection.end();
    console.log("Question loaded into database")
}

function checkAnswer(user, message) {
  if (message.toLowerCase() === answer.toLowerCase()) {
    var name = user["display-name"] || user["username"];
    client.action(channel, `${name} guessed the correct answer: ${answer}`);
    askQuestion();
  }
}

function askQuestion() {
  if (curr === questionSet.length) {
    client.action(channel, "Those are all questions, thanks for playing!");
    return;
  }
  question = questionSet[curr].question;
  answer = questionSet[curr].answer;
  curr = curr + 1;
  client.action(channel, `Question #${curr} of ${questionSet.length}: ${question}`);
}

// function createWebsite() {
//   http.createServer(function (req, res) {
//     res.writeHead(200, {'Content-Type': 'text/plain'});
//     res.end(`${question}`);
//   }).listen(8080);
// }

// function createHTML() {
//   http.createServer(function(req, res){
//     res.writeHead(200, {'Content-Type': 'text/html'});
//     var myReadStream = fs.createReadStream(__dirname + '/index.html', 'utf8');
//     myReadStream.pipe(res);
//   }).listen(8080);
// }

function renderWebsite() {
  app.engine('handlebars', handlebars.engine);
  app.set('view engine', 'handlebars');
  app.use(express.static(__dirname + '/'));
  app.get('/', function(req, res, next) {
    res.render('index', {
      layout: 'main',
      question: question,
    });
  });
  app.listen(8080);
}

function renderWebsiteSOCKET() {
  app.engine('handlebars', handlebars.engine);
  app.set('view engine', 'handlebars');
  app.use(express.static(__dirname + '/'));
  app.get('/', function(req, res, next) {
    res.render('index', {
      layout: 'main',
      question: question,
    });
  });
  app.listen(8080);
  io.on('connection', function (socket) { // Notify for a new connection and pass the socket as parameter.
    console.log('new connection');

    var incremental = 0;
    setInterval(function () {
        console.log('emit new value', incremental);

        socket.emit('update-value', incremental); // Emit on the opened socket.
        incremental++;
    }, 1000);

});
}
