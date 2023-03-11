
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);

var cmd = `git add *
git commit -m "Update the infomations."
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts
ssh-keyscan -t rsa gitlab.com >> ~/.ssh/known_hosts
git push -u git@gitlab.com:wifi-left/mcdata-auto.git main`;
var cmds = cmd.split("\n");

const runClean = async function () {
    // cwd指定子进程的当前工作目录 这里的rm -rf build为删除指定目录下的一个文件夹
    for(var i =0;i<cmds.length;i++){
        await exec(cmds[i], { cwd: "./mcdata-auto" });
    }
}
runClean();

