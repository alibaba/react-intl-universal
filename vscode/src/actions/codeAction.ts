import * as vscode from 'vscode'
import CommandConstants from '../constants/commands';
const CRC32 = require('crc-32'); 
abstract class Extract implements vscode.CodeActionProvider {
  abstract getCommands(params: any): vscode.Command[]

  provideCodeActions(): vscode.Command[] {
    const editor: any = vscode.window.activeTextEditor
    const { selection } = editor;
    const text = editor.document.getText(selection)
    const start = selection.start;
    const end = selection.end;
    if (!text || selection.start.line !== selection.end.line) {
      return [];
    }
    if (!/[\u4e00-\u9fa5]/.test(text)) {
      return [];
    }
    return this.getCommands({
      range: {
        startLine: start.line,
        startColumn: start.character,
        endLine: end.line,
        endColumn: end.character,
      },
      text,
      key: CRC32.str(text),
      type: 'replaceWhole'
    })
  }
}
// range: range,
// text: info.intlText,
// key: CRC32.str(info.intlText),
// type: 'replaceWhole'
class ExtractProvider extends Extract {
  getCommands(params: any) {
    return [
      {
        command: CommandConstants.OPEN_WEBVIEW,
        title: `提交到服务器`,
        arguments: [
          {
            ...params
          }
        ]
      }
    ]
  }
}

export const extractEditor = (context: any) => {
  context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
    [
      { language: 'vue', scheme: '*' },
      { language: 'javascript', scheme: '*' },
      { language: 'typescript', scheme: '*' }
    ],
    new ExtractProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.Refactor]
    }
  ));
}
