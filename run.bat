@echo off
del package-lock.json
call npm install archiver
call npm install fs
call npm install node-fetch@2.6.2
call npm install minimist
call npm test
git add *