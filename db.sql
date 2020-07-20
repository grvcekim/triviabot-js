DROP DATABASE IF EXISTS `triviabot`;
CREATE DATABASE `triviabot`; 
USE `triviabot`;

SET NAMES utf8;
SET character_set_client = utf8mb4;

DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `qid` tinyint(4) NOT NULL,
  `question` varchar(250) NOT NULL,
  `answer` varchar(100) NOT NULL,
  PRIMARY KEY (`qid`)
);

DROP TABLE IF EXISTS `leaderboard`;
CREATE TABLE `leaderboard` (
  `user_hash` varchar(120) NOT NULL,
	`score` tinyint(4) NOT NULL,
  PRIMARY KEY (`user_hash`)
);