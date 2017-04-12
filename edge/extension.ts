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

    format(document: vscode.TextDocument, documentOptions: vscode.FormattingOptions, cancellationToken: vscode.CancellationToken, range?: vscode.Range, resumeOnError: boolean = false): vscode.ProviderResult<vscode.TextEdit[]> {
        const formattingOptions = {
            ...this.workspaceFormattingOptions,
            tabStopChar: documentOptions.insertSpaces ? ' '.repeat(documentOptions.tabSize) : '\t',
            newLineChar: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
        }

        try {
            const result = format(document.getText(range), formattingOptions)

            if (result.warnings.length > 0 && resumeOnError === false) {
                vscode.window.showWarningMessage(result.warnings[0].message)
                result.warnings.forEach(warn => {
                    console.warn(warn.message)
                })
            }

            if (cancellationToken.isCancellationRequested) {
                return null
            } else if (range) {
                return [vscode.TextEdit.replace(range, result.text)]
            } else {
                return [vscode.TextEdit.replace(new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), result.text)]
            }

        } catch (ex) {
            if (resumeOnError === false) {
                vscode.window.showWarningMessage(ex.message)
                console.error(ex)
            }

            return null
        }
    }

    provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token)
    }

    provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
        return this.format(document, options, token, range, true)
    }
}

const formatter = new Formatter()

export function activate(context: vscode.ExtensionContext) {
    formatter.configure()

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        formatter.configure()
    }))

    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('stylus', formatter))

    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider('stylus', formatter))
}

export function deactivate() { }