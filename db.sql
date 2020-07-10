DROP DATABASE IF EXISTS `triviabot`;
CREATE DATABASE `triviabot`; 
USE `triviabot`;

SET NAMES utf8;
SET character_set_client = utf8mb4;

DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `question_id` tinyint(4) NOT NULL AUTO_INCREMENT,
  `question` varchar(250) NOT NULL,
  `answer` varchar(100) NOT NULL,
  PRIMARY KEY (`question_id`)
)
INSERT INTO `questions` VALUES (1, 'hi', 'bye');
INSERT INTO `questions` VALUES (2, 'bye', 'hi');


DROP TABLE IF EXISTS `leaderboard`;
CREATE TABLE `leaderboard` (
  `user_hash` varchar(120) NOT NULL,
	`score` tinyint(4) NOT NULL,
  PRIMARY KEY (`user_hash`)
) 
INSERT INTO `leaderboard` VALUES ('abcd1234', 2);
INSERT INTO `leaderboard` VALUES ('efgh5678', 6);

ALTER TABLE `leaderboard` ORDER BY `score` DESC;