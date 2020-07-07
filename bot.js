// username must be named a mod in the channel -> /mod <username> in channel's chat

const tmi = require('tmi.js');
const csv = require('csv-parser');
const fs = require('fs');
var shuffle = require('shuffle-array');
const http = require('http');
const express = require('express')
const app = express()

const options = {
  options: {
    debug: true,
  },
  identity: {
    username: 'rabeya74',
    password: 'oauth:e3gqotcj8g17xmqk6zngxuvhb2nv2x',
    // username: 'grvcekim',
    // password: 'oauth:am6u2pot7mgiiuhzuhno34nl6uhrby',
  },
  channels: ['rabeya74'],
};

const channel = 'rabeya74';
const file = 'trivia.csv';
var curr = 0;
var questionSet = [];
var question = '';
var answer = '';

const client = new tmi.client(options);

client.connect();
loadQuestions(file);

client.on('connected', onConnectedHandler);
client.on('chat', onChatHandler);
createWebsite();

function onConnectedHandler(address, port) {
  client.action(channel, 'bot has connected');
  askQuestion();
};

function onChatHandler(channel, user, message, self) {
  if (self) { return };
  if (message.toLowerCase() === answer.toLowerCase()) {
    var name = user["display-name"] || user["username"];
    client.action(channel, `${name} guessed the correct answer: ${answer}`);
    askQuestion();
  }
};

function loadQuestions(file) {
	fs.createReadStream(file)
  .pipe(csv())
  .on('data', (row) => {
		console.log(row);
		questionSet.push(row) //appends row to questionSet array
  })
  .on('end', () => {
		console.log('CSV file successfully processed');
  });
  shuffle(questionSet);
}

function askQuestion() {
  if (curr === questionSet.length) {
    client.action(channel, 'Those are all questions, thanks for playing!');
    return;
  }
  question = questionSet[curr].question;
  answer = questionSet[curr].answer;
  curr = curr + 1;
  client.action(channel, `Question #${curr} of ${questionSet.length}: ${question}`);
}

function createWebsite() {
  http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(`${question}`);
    // res.end('Hello World!');
  }).listen(8080);
}