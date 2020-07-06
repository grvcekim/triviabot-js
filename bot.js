// username must be named a mod in the channel -> /mod <username> in channel's chat

const tmi = require('tmi.js');

const options = {
  options: {
    debug: true,
  },
  identity: {
    username: 'grvcekim',
    password: 'oauth:am6u2pot7mgiiuhzuhno34nl6uhrby',
  },
  channels: ['dujsnd'],
};

const channel = 'dujsnd';
var question = 'do u like mgg?';
var answer = 'yes';

const client = new tmi.client(options);

client.connect();

client.on('connected', onConnectedHandler);
client.on('chat', onChatHandler);

function onConnectedHandler(address, port) {
  client.action(channel, 'bot has connected');
  askQuestion();
};

function onChatHandler(channel, user, message, self) {
  if (self) { return };

  if (message === answer) {
    var name = user["display-name"] || user["username"];
    client.action(channel, `${name} guessed the correct answer: ${answer}`);
    askQuestion();
  }
};

function askQuestion() {
  client.action(channel, question);
}