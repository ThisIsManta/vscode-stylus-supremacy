import * as vscode from 'vscode'
import { format } from 'stylus-supremacy'

const defaultFormattingOptions = require('stylus-supremacy/edge/defaultFormattingOptions.json')

class Formatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    private workspaceFormattingOptions: object

    configure() {
        this.workspaceFormattingOptions = {}

        const config = vscode.workspace.getConfiguration('stylusSupremacy')
        for (let name in defaultFormattingOptions) {
            if (config.has(name)) {
                this.workspaceFormattingOptions[name] = config.get(name)
            }
        }
    }

    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        const formattingOptions = {
            ...this.workspaceFormattingOptions,
            tabStopChar: options.insertSpaces ? ' '.repeat(options.tabSize) : '\t',
            newLineChar: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
        }

        try {
            const result = format(document.getText(), formattingOptions)

            if (result.warnings.length > 0) {
                vscode.window.showWarningMessage(result.warnings[0].message)
                result.warnings.forEach(warn => {
                    console.log(warn.message)
                })
            }

            return [vscode.TextEdit.replace(new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), result.text)]

        } catch (ex) {
            vscode.window.showWarningMessage(ex.message)
            console.log(ex);

            return null
        }
    }

    provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return null
    }
}

const formatter = new Formatter()

export function activate(context: vscode.ExtensionContext) {
    formatter.configure()

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        formatter.configure()
    }))

    context.subscriptions.push(vscode.commands.registerCommand('stylusSupremacy.format', () => {
        vscode.window.showInformationMessage('Hello World!')
    }))

    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('stylus', formatter))
}

export function deactivate() { }