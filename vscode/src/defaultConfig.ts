import NodeConstants from "./constants/node";
import * as vscode from 'vscode';
import utils from "./utils";
const fs = require('fs');
export default {
    langKey: {
        zh_CN: '中文',
        // en_US: '英文',
    },// 一共支持哪些语言, 必选
    isAli: false,
    mdsProjectName: null,
    notSameText: '不一致',
    defaultLang: 'zh_CN', // 代码里面写的是那种语言, .d后面的语言
    prefixStatusText: '缺少',
    displayErrorLangs: null, // 显示红色
    displayWarnLangs: null, // 显示黄色 NodeConstants.KEY_SAME
    fileCheckLangs: null, // 批量检查的时候, 检查哪些错误 
    defaultFuncNameReg: /^d|defaultMessage$/,
    getFuncNameReg: /^get|getHTML$/,
    skipFolderReg: /(?:locales|intl\.config)/,
    checkFileReg: /\.(?:ts|js|jsx|tsx)$/,
    ignoreCheckNode: (node: any) => {
        return false;
    },
    uploadLang: (task: any, key: any, text: any, callback: any) => {
        task.updateLocals({
            [task.configObj.defaultLang]: [
                {
                    key: key,
                    text: text
                }
            ]
        });
        callback && callback();
    },
    getLang: (configObj: any) => {
        const localeDir = utils.getLocalDir(configObj);
        if (!fs.existsSync(localeDir)) {
            vscode.window.showWarningMessage('当前文件父目录中, 找不到locales目录, 请确定是否有locales目录');
            throw(new Error('找不到locales目录, 请至少选择src下面一个文件并打开'))
        }
        try {
            const langMap: any = {}
            Object.keys(configObj.langKey).forEach(key => {
                langMap[key] = JSON.parse(fs.readFileSync(`${localeDir}/${key}.json`).toString())
            });
            return langMap;
        } catch (e) {
            console.log(e);
            vscode.window.showWarningMessage(e);
        }
    }
}