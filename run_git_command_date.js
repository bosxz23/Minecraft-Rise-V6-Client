
const child_process = require('child_process');
const util = require('util');
const exec = util.promisify(child_process.exec);
let fs = require('fs')

var day = new Date().toUTCString();

console.log("Running on " + day);

var cmd = `git add *
git commit -m "Check the update on ${day}."
git push origin`;
var cmds = cmd.split("\n");

fs.writeFileSync("./updatetime.json", day);

const runClean = async function () {
    // cwd指定子进程的当前工作目录 这里的rm -rf build为删除指定目录下的一个文件夹
    try {
        for (var i = 0; i < cmds.length; i++) {
            await exec(cmds[i], { cwd: "." });
        }
    } catch (e) {
        console.warn("STDERR #" + (i + 1) + ": " + e.message);
    }

}
runClean().then(() => {
    console.log("Done CMD #1")
}).then(() => {
    console.log("Done CMD #2")
}).then(() => {
    console.log("Done CMD #3")
}).then(() => {
    console.log("Done CMD #4")
}).then(() => {
    console.log("Done CMD #5")
});

