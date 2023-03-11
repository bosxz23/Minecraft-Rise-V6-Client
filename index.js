/**
 * 文件下载
 * @param {*} url 下载地址
 * @param {*} dest 文件保存的路径，如：D:/download/app/ybx1.apk
 * @param {*} cb 回调函数参数1为区别哪个加试，如：'download'下载结束，'data'下载进度，'finish'文件写入结束
 */
let http = require('http')
let https = require('https')
let url = require('url')
let util = require('util')
let fs = require('fs')
const fetch = require('node-fetch')
const archiver = require('archiver');

let infomations = {};
if (fs.existsSync("./info.json")) {
    try {
        infomations = JSON.parse(fs.readFileSync("./info.json"));
    } catch (e) {
        infomations = {};
    }
};
const args = process.argv.slice(2)
let parargs = {};
try {
    parargs = require('minimist')(args)
} catch (e) {
    console.warn(e);
}
console.log("Args: " + JSON.stringify(args));
let targetversion = undefined;
if (parargs['version'] != undefined) {
    targetversion = parargs['version']
}

console.log("Downloading https://piston-meta.mojang.com/mc/game/version_manifest.json ...")
if (!fs.existsSync("./output"))
    fs.mkdirSync("./output")
if (!fs.existsSync("./files"))
    fs.mkdirSync("./files")


/**
 * zip file
 *   sourceFile，待压缩的文件
 *   destZip，压缩后的zip文件
 *   cb，callback
 */
function zipFile(sourceFile, destZip, cb) {
    // init
    var output = fs.createWriteStream(destZip);
    var archive = archiver('zip', {
        zlib: { level: 9 }
    });

    // on
    output.on('close', function () {
        cb("finish", 'zip file success!');
    });
    archive.on('error', function (err) {
        cb("error", err);
    });

    // zip
    archive.pipe(output);
    archive.file(sourceFile, {
        name: path.basename(sourceFile)
    });
    archive.finalize();
}

/**
* zip folder
*   sourceFolder，待压缩的文件夹
*   destZip，压缩后的zip文件
*   cb，回调函数
*   subdir，是否需要包一层
*/
function zipFolder(sourceFolder, destZip, cb, subdir) {
    // init
    var output = fs.createWriteStream(destZip);
    var archive = archiver('zip', {
        zlib: { level: 9 }
    });

    // on
    output.on('close', function () {
        cb("finish", 'zip folder success!');
    });
    archive.on('error', function (err) {
        cb("error", err);
    });

    // zip
    archive.pipe(output);
    archive.directory(sourceFolder, subdir ? sourceFolder.substr(path.dirname(sourceFolder).length + 1) : false);
    archive.finalize();
}

const downloadFile = (url, dest, cb = () => { }) => {
    // 确保dest路径存在
    const file = fs.createWriteStream(dest)
    const urlImage = url;

    https.get(urlImage, (res) => {
        if (res.statusCode !== 200) {
            cb(response.statusCode)
            return
        }

        // 进度
        const len = parseInt(res.headers['content-length']) // 文件总长度
        let cur = 0
        const total = (len / 1048576).toFixed(2) // 转为M 1048576 - bytes in  1Megabyte
        res.on('data', function (chunk) {
            cur += chunk.length
            const progress = (100.0 * cur / len).toFixed(2) // 当前进度
            const currProgress = (cur / 1048576).toFixed(2) // 当前了多少
            cb('data', progress, currProgress, total)
        })

        res.on('end', () => {
            // console.log('下载结束')
            cb('download')
        })

        // 超时,结束等
        file.on('finish', () => {
            // console.log('文件写入结束')
            file.close(cb('finish'))
        }).on('error', (err) => {
            unlink(dest)
            if (cb) cb('error', err.message)
        })
        res.pipe(file)
    })
}
console.log("Fetching https://piston-meta.mojang.com/mc/game/version_manifest.json")
let lang = "zh_cn";
if (infomations['supportVersions'] == undefined) infomations['supportVersions'] = [];

fetch('https://piston-meta.mojang.com/mc/game/version_manifest.json')
    .then(res => res.json())
    .then(json => {
        let data = json['versions']
        let flag = false;
        for (var i = 0; i < data.length; i++) {
            if (targetversion != undefined) {
                if (data[i]['id'] == targetversion) {
                    flag = true;
                    fetchVersionDetails(data[i]);
                    break;
                }
            } else if (data[i]['type'] == 'release') {
                fetchVersionDetails(data[i]);
                flag = true;
                break;
            }
        }
        if (!flag) {
            console.log("Failed to update the infomation of Minecraft!" + (targetversion != undefined ? " Target Version: " + targetversion : ""));
        }
    });

function fetchVersionDetails(data) {
    let url = data['url'];
    console.log("The current version of Minecraft is " + data['id']);
    if (infomations['version'] == data['id']) {
        console.log("No need to update.")
        return;
    }
    console.log("Fetching " + url);
    infomations['version'] = data['id'];
    infomations['supportVersions'].push(data['id']);
    fetch(url)
        .then(res => res.json())
        .then(json => {
            let url = json['assetIndex']['url'];
            console.log("Fetching " + url);
            fetch(url)
                .then(res => res.json())
                .then(json => {
                    let objects = json['objects'];
                    for (var i in objects) {
                        if (i == `minecraft/lang/${lang}.json`) {
                            let hash = objects[i]['hash'];
                            console.log("Downloading Object [" + hash + "]");
                            //https://resources.download.minecraft.net/<hash的前两位字符>/<hash>
                            let index = hash.substring(0, 2);
                            let url = `https://resources.download.minecraft.net/${index}/${hash}`;
                            console.log("[URL: " + url + "]");
                            infomations['updateDate'] = new Date();
                            fetch(url)
                                .then(res => res.json())
                                .then(json => {
                                    fs.writeFileSync(`./output/${lang}.json`, JSON.stringify(json));
                                    fs.writeFileSync("./output/info.json", JSON.stringify({ "version": infomations['version'], "updateDate": infomations['updateDate'] }));
                                    fs.writeFileSync("./output/items.json", JSON.stringify(getItems(json)));
                                    fs.writeFileSync("./output/blocks.json", JSON.stringify(getBlocks(json)));
                                    fs.writeFileSync("./output/effects.json", JSON.stringify(getEffects(json)));
                                    fs.writeFileSync("./output/entities.json", JSON.stringify(getEntities(json)));
                                    fs.writeFileSync("./output/enchantments.json", JSON.stringify(getEnchantments(json)));
                                    fs.writeFileSync("./output/gamerules.json", JSON.stringify(getGamerules(json)));
                                    //getGamerules
                                    fs.writeFileSync("./info.json", JSON.stringify(infomations));
                                    console.log("Compressing the files...");
                                    zipFolder("./output", `./files/${infomations['version']}.zip`, CompressTheFiles, false);
                                });
                            break;
                        }
                    }
                });
        });
}
function CompressTheFiles(op, msg) {
    if(op=='error'){
        console.error("Error while compressing: "+msg.message);
        console.error(msg);
    }else if(op=='finish'){
        console.log("Compressed succeessfully.")
    }
}
// downloadFile("https://piston-meta.mojang.com/mc/game/version_manifest.json", "./versions.json", (state, pro, currPro, total) => {
//     if (state == 'data') {
//         // 下载进度
//         console.log("Downloading... " + pro + "%")

//     } else if (state == 'finish') {
//         console.log(parsing)
//     } else if (state == 'error') {
//         console.error("Error!", pro);
//     }

//     // console.log(state);
// })
const ItemIgnoreList = ["lava", "water", "air", "lodestone_compass"];
// 纯方块或者是give无效id
function getItems(lang) {
    var result = [];
    // let lastBlockId = "";
    for (var i in lang) {
        if (i.substring(0, "item.minecraft.".length) == "item.minecraft.") {
            let id = i.substring("item.minecraft.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];
            if (ItemIgnoreList.indexOf(id) != -1) {
                continue;
            }
            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        } else if (i.substring(0, "block.minecraft.".length) == "block.minecraft.") {
            let id = i.substring("block.minecraft.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            if (id.search("wall_") != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            if (id.search("attached_") != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            if (id.search("_cake") != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            if (id.search("_cauldron") != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            /*wall_
            attached_
            _cake
            _cauldron
            */
            /*
            手动排除列表
            */
            if (ItemIgnoreList.indexOf(id) != -1) {
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];

            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        }
    }
    return result;
}
function getBlocks(lang) {
    var result = [];
    for (var i in lang) {
        if (i.substring(0, "block.minecraft.".length) == "block.minecraft.") {
            let id = i.substring("block.minecraft.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];

            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        }
    }
    return result;
}
function getEntities(lang) {
    var result = [];
    for (var i in lang) {
        if (i.substring(0, "entity.minecraft.".length) == "entity.minecraft.") {
            let id = i.substring("entity.minecraft.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];

            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        }
    }
    return result;
}
function getEnchantments(lang) {
    //enchantment.minecraft.
    var result = [];
    for (var i in lang) {
        if (i.substring(0, "enchantment.minecraft.".length) == "enchantment.minecraft.") {
            let id = i.substring("enchantment.minecraft.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];

            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        }
    }
    return result;
}
function getEffects(lang) {
    var result = [];
    for (var i in lang) {
        if (i.substring(0, "effect.minecraft.".length) == "effect.minecraft.") {
            let id = i.substring("effect.minecraft.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];

            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        }
    }
    return result;
    //effect.minecraft.
}
function getGamerules(lang) {
    var result = [];
    for (var i in lang) {
        if (i.substring(0, "gamerule.".length) == "gamerule.") {
            let id = i.substring("gamerule.".length);
            if (id.search(/\./) != -1) {
                // if(id.search("\.des"))
                // console.log(id)
                continue;
            }
            let name = lang[i];
            let des = lang[i + ".desc"];

            if (des != undefined) {
                result[result.length] = { id: id, name: name + " - " + des };
            } else {
                result[result.length] = { id: id, name: name };
            }
            // console.log(name);
        }
    }
    return result;
    //effect.minecraft.

}