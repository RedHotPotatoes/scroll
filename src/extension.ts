import * as vscode from 'vscode';

async function getTextSelectionFromTerminal() {
    const clipboardText = await vscode.env.clipboard.readText();

    await vscode.env.clipboard.writeText('');
    await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
    await new Promise(resolve => setTimeout(resolve, 100));

    const selectionText = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(clipboardText);
    return selectionText;
}

function getServerAddress() {
    const config = vscode.workspace.getConfiguration('scroll');
    return config.serverAddress;
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new ScrollViewProvider(context);

    vscode.window.onDidChangeActiveColorTheme(() => {
        sendThemeInfo();
    });

    const getThemeKind = () => {
        const kind = vscode.window.activeColorTheme.kind;
        if (kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast) {
            return 'dark';
        }
        return 'light';
    };

    const sendThemeInfo = () => {
        const themeKind = getThemeKind();
        provider.postMessage({ themeKind });
    };
    sendThemeInfo();

    context.subscriptions.push(
        vscode.commands.registerCommand('scroll.startNewSession' , () => {
            provider.postMessage({ command: 'startNewSession' });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('scroll.troubleshootFromSelection' , () => {
            const editor = vscode.window.activeTextEditor;
            const terminal = vscode.window.activeTerminal;
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                provider.postMessage({ command: 'startNewSession', searchText: selectedText });
                return; 
            }

            if (terminal) {
                getTextSelectionFromTerminal().then(selectedText => {
                    if (!selectedText) {
                        return;
                    }
                    provider.postMessage({ command: 'startNewSession', searchText: selectedText });
                });
                return;
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('scroll.troubleshootFromClipboard' , () => {
            vscode.env.clipboard.readText().then(clipboardText => {
                if (!clipboardText) {
                    return;
                }
                provider.postMessage({ command: 'startNewSession', searchText: clipboardText });
            });
        })
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ScrollViewProvider.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    const handler: vscode.UriHandler = {
        handleUri(uri: vscode.Uri) {
            const queryParams = new URLSearchParams(uri.query);
            const token = queryParams.get('access_token');
            if (token) {
                context.secrets.store('oauth_token', token);
                provider.postMessage({ auth: 'loggedIn' });

                vscode.window.showInformationMessage('You have successfully logged in to Scroll.');
            } 
        }
    };
    context.subscriptions.push(vscode.window.registerUriHandler(handler));

    // The token could be expired: initially user will be logged in 
    // but then will be logged out after the first request
    // since it get 401 from the backend.
    context.secrets.get('oauth_token').then(token => {
        if (token) {
            provider.postMessage({ auth: 'loggedIn' });
        }
    });
}

class ScrollViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'scroll.scrollview';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly context: vscode.ExtensionContext,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        this._view.webview.options = {
            enableScripts: true,
        };
		
		const appPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'app.js');
		const appUri = this._view.webview.asWebviewUri(vscode.Uri.file(appPath.path));
        this._view.webview.html = this._getHtmlForWebview(appUri);
        this._setup_messaging();
    }

    public postMessage(message: { themeKind?: string; command?: string; [key: string]: any }) {
        this._view?.webview.postMessage(message);
    }

    private _setup_messaging() {
        this._view?.webview.onDidReceiveMessage(async (message) => {
            switch (message.auth) {
                case 'getToken':
                    const token = await this.context.secrets.get('oauth_token');
                    this.postMessage({ token: token });
                    break;
        
                case 'login':
                    const uri = `${getServerAddress()}/auth/google`;
                    vscode.env.openExternal(vscode.Uri.parse(uri));
                    break;
        
                case 'logout':
                    await this.context.secrets.delete('oauth_token');
                    this.postMessage({ auth: 'loggedOut' });
                    break;
            }
            switch (message.config) {
                case 'getServerAddress':
                    this.postMessage({ serverAddress: getServerAddress() });
                    break;
            }
        });
    }

	private _getHtmlForWebview(appUri: vscode.Uri) {
		return `<!DOCTYPE html>
			<html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Webview</title>
                </head>
                <body>
                    <div id="root"></div>
                    <script>
                        const vscode = acquireVsCodeApi();
                    </script>
                    <script src="${appUri}"></script>
                </body>
			</html>`;
	}
}

export function deactivate() {
    // Clean up resources when the extension is deactivated
}
