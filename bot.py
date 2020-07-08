from config import *
import socket
import csv
import random
import sys

# list of (question, answer) tuples
questions = []
# current question #, starting at 1
q_num = 0
# current question
question = ""
# current answer
answer = ""
# flag to close server and bot when game is over
game_over = False

# initialize socket connection
def startSocket():
    server = socket.socket()
    server.connect((HOST, PORT))
    server.send(bytes("PASS " + PASS + "\r\n", "utf-8"))
    server.send(bytes("NICK " + NICK + "\r\n", "utf-8"))
    server.send(bytes("JOIN #" + CHANNEL + "\r\n", "utf-8"))
    return server

# join chat
def joinChat(server):
    while True:
        line = server.recv(2048).decode("utf-8").split("/n").pop()
        if "End of /NAMES list" in line:
            sendMsg(server, "triviabot has joined the chat")
            return

# parse csv file to load questions
def loadQuestions():
    global questions
    with open(FILE, 'r') as csv_file: 
        # create a csv reader object 
        csv_reader = csv.reader(csv_file) 
        # extract each data row one by one 
        for row in csv_reader: 
            questions.append((row[0], row[1]))
        # remove header row
        questions = questions[1:]
        # randomize order of questions
        random.shuffle(questions)
        print("Total number of questions: %d" % len(questions)) 
        # print(questions)

# choose next question from global questions list and update global question, answer, q_num
# vars accordingly. releases question in chat
def chooseQuestion():
    global questions, q_num, question, answer, game_over
    # if all questions have been released, tells chat game is over and updates game_over flag
    if q_num == len(questions):
        sendMsg(server, "Those are all the questions we have! Thanks for playing :^)")
        game_over = True
        return
    curr = questions[q_num]
    question = curr[0]
    answer = curr[1]
    q_num += 1
    # release question in chat
    sendMsg(server, "Question #%d: %s" % (q_num, question))

# pongs server back to avoid timing out
def pong(server, line):
    server.send(bytes(line.replace("PING", "PONG") + "\r\n", "utf-8"))
    print("ponged")

# extracts username
def getUser(line):
    return line.split("!")[0][1:]

# extracts message
def getMsg(line):
    return line.split(":")[2]

# checks if message contains correct answer
def checkAnswer(msg):
    global answer
    if answer.lower() not in msg.lower():
        return False
    return True

# sends message to chat
def sendMsg(server, msg):
    server.send(bytes("PRIVMSG #" + CHANNEL + " :" + msg + "\r\n", "utf-8"))
    print("Sent:", msg)


def run(server):
    loadQuestions()
    server = startSocket()
    joinChat(server)
    chooseQuestion()
    while True:
        # parse through data received from server
        line = server.recv(2048).decode("utf-8").split("\n")
        if len(line) == 2:
            # line is individual chat messages or pings from server
            line = line[0]
            print(line)
            # if server pings, pong back and receive next line
            if "PING" in line:
                pong(server, line)
                continue
            # if user sends a chat message, parse user and message
            else:
                user = getUser(line)
                msg = getMsg(line)
                print(user + ": " + msg)
        # if message contains the answer, tell chat and choose new question
        if checkAnswer(msg):
            sendMsg(server, user + " guessed the correct answer: " + answer)
            chooseQuestion()
        # if all questions have been asnwered, quit bot
        if game_over:
            print("game over")
            server.close()
            sys.exit(0)


if __name__ == "__main__":
    run()
