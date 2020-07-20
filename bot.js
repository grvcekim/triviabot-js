// username must be named a mod in the channel -> /mod <username> in channel's chat
require('dotenv').config();
const tmi = require('tmi.js');
const createCsvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mysql = require('mysql');
const fs = require('fs');
var handlebars = require('express-handlebars').create({ defaultLayout: 'main' });
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

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

const channel = process.env.CHANNEL;
const file = "trivia.csv";
var curr = 0;
var questionSet = [];
var question = "foo";
var answer = "";
var localLeaderboard = [];
const csvWriter = createCsvWriter({
  path: "out.csv",
  header: [
    { id: "name", title: "Name" },
    { id: "score", title: "Score" },
  ],
});

const client = new tmi.client(options);

client.connect();
loadQuestions(file);

client.on("connected", onConnectedHandler);
client.on("chat", onChatHandler);
renderWebsite();

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
}

function checkAnswer(user, message) {
  if (message.toLowerCase() === answer.toLowerCase()) {
    var name = user["display-name"] || user["username"];
    client.action(channel, `${name} guessed the correct answer: ${answer}`);
    askQuestion();
    addToLeaderboard(name);
  }
}

function clearLeaderboard() {
  fs.writeFile("out.csv", "", function () {
    console.log("done");
  });
}

function addToLeaderboard(name) {
  clearLeaderboard();
  var i;
  for (i = 0; i < localLeaderboard.length; i++) {
    var curr = localLeaderboard[i];
    if (curr.name === name) {
      curr.score = curr.score + 1;
      csvWriter
        .writeRecords(localLeaderboard)
        .then(() => console.log("The CSV file was written successfully"));
      return;
    }
  }
  var newEntry = { name: "", score: 0 };
  newEntry.name = name;
  newEntry.score = 1;
  localLeaderboard.push(newEntry);
  csvWriter
    .writeRecords(localLeaderboard)
    .then(() => console.log("The CSV file was written successfully"));
}

function askQuestion() {
  if (curr === questionSet.length) {
    client.action(channel, "Those are all questions, thanks for playing!");
    return;
  }
  question = questionSet[curr].question;
  answer = questionSet[curr].answer;
  curr = curr + 1;
  client.action(
    channel,
    `Question #${curr} of ${questionSet.length}: ${question}`
  );
}


function renderWebsite() {
  app.engine('handlebars', handlebars.engine)
  app.set('view engine', 'handlebars');
  app.get('/', function (req, res, next) {
    res.render('index', {
      layout: 'main',
      question: question,
    });
  });
  http.listen(8080, () => {
      console.log("listening on port 8080");
      io.on('connection', function (socket) { // Notify for a new connection and pass the socket as parameter.
        console.log('new connection');
      });
  });
}
var incremental = 0;
setInterval(function () {
  console.log('emit new value', incremental);
  incremental += 1;

  io.emit('update-value', incremental); // Emit on the opened socket.
}, 1000);
