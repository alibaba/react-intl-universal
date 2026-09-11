const path = require('path');
module.exports = ({vscode, utils, constants}) => {
    return {
        localeDir: path.join(__dirname, 'src/locales'),
        langKey: {
            en_us: '英语',
            zh_cn: '中文',
            zh_tw: '台湾',
        },
        defaultLang: 'zh_cn',
        displayWarnLangs: ['zh_cn', 'zh_tw', constants.KEY_SAME] // 显示黄色
    }
}