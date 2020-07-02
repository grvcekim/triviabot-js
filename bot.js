const tmi = require('tmi.js');

// Define configuration options
const opts = {
  identity: {
    username: "triviabot",
    password: "oauth:085klbdmtxwcmnkrzeoliiylrng33i"
  },
  channels: [
    "mhrosen"
  ]
};

// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called every time a message comes in
function onMessageHandler (target, context, msg, self) {
  if (self) { return; } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  if (commandName === '!dice') {
    const num = rollDice();
    client.say(target, `You rolled a ${num}`);
    console.log(`* Executed ${commandName} command`);
  } else {
    console.log(`* Unknown command ${commandName}`);
  }
}
// Function called when the "dice" command is issued
function rollDice () {
  const sides = 6;
  return Math.floor(Math.random() * sides) + 1;
}
// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}
















// var question = "where do u intern y'allsllszzz"
// var answer = "ibm"

// // Called every time a message comes in
// function onMessageHandler (target, context, msg, self) {
//   if (self) { return; } // Ignore messages from the bot

//   // Remove whitespace from chat message
//   const commandName = msg.trim();

//   if (commandName === answer) {
//     client.say(target, `Correct answer!`);
//     console.log(`* Correct guess: ${answer}`);
//   } else {
//     client.say(target, `Try again!`);
//     console.log(`* Incorrect guess: ${commandName}`);
//   }
//   // If the command is known, let's execute it
//   // if (commandName === '!dice') {
//   //   const num = rollDice();
//   //   client.say(target, `You rolled a ${num}`);
//   //   console.log(`* Executed ${commandName} command`);
//   // } else {
//   //   console.log(`* Unknown command ${commandName}`);
//   // }
// }
// // Function called when the "dice" command is issued
// // function rollDice () {
// //   const sides = 6;
// //   return Math.floor(Math.random() * sides) + 1;
// // }

// // Called every time the bot connects to Twitch chat
// function onConnectedHandler (target, addr, port) {
//   console.log(`* Connected to ${addr}:${port}`);
//   // client.say(target, question);
//   // console.log(`* Asked question: ${question}`);
// }