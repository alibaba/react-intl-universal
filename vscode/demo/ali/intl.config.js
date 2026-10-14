const path = require('path');
module.exports = ({vscode, utils, constants, defaultConfig}) => {
    return {
        localeDir: path.join(__dirname, 'src/locales'),
        isAli: true,
        mdsProjectName: 'XXX',
        langKey: {
            ...defaultConfig.langKey,
            zh_TW: '台湾'
        }
    }
}