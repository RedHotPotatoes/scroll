import React, { Component, createRef } from 'react';
import { render } from 'react-dom';
import { Prism } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import FloatingPreview from './floatingPreview';

import assistantLogo from './assets/assistant-logo.png';
import userLogo from './assets/user-logo.png';
import goButton from './assets/go-button.png';
import likeButton from './assets/like-button.png';
import likedButton from './assets/liked-button.png';
import dislikeButton from './assets/dislike-button.png';
import dislikedButton from './assets/disliked-button.png';

import './styles/app.css';

const Markdown = require('markdown-to-jsx');

interface vscode {
    postMessage(message: any): void;
}

declare const vscode: vscode;

class Message {
    text: string;
    isUser: boolean;

    constructor(text: string, isUser: boolean) {
        this.text = text;
        this.isUser = isUser;
    }
}

interface AppProps {

}
interface AppState {
    messages: Message[];
    input: string;
    lastAiMessage: Message | null;
    inputPlaceholder: string;
    inputHeight: string;
    isInputActive: boolean;
    themeKind: string;
    likedMessage: boolean;
    dislikedMessage: boolean;
    streamingAIMessage: boolean;
    hoveredReferenceLink: {
        previewData?: {
            url: string;
        };
        x?: number;
        y?: number;
    }
    isLoggedIn: boolean;
}

class App extends Component<AppProps, AppState> {
    private inputRef: React.RefObject<HTMLTextAreaElement>;
    private chatEndRef: React.RefObject<HTMLDivElement>;
    private queryId: string | null = null;

    private serverAddress: string | null = null;

    private placeholder: string = 'Paste error here...';
    private placeholderFollowUp: string = 'Follow Up';

    private resolveTokenPromise: ((value: string) => void) | null = null;
    private resolveServerAddressPromise: ((value: string) => void) | null = null;

    constructor(props: any) {
        super(props);
        this.state = {
            ...this._initState(),
            isLoggedIn: false,
        };
        this.inputRef = createRef();
        this.chatEndRef = createRef();
        this._fetchServerAddress().then((address) => {
            this.serverAddress = address;
        });
    }

    private _initState = () => {
        return {
            messages: [],
            lastAiMessage: null,
            input: '',
            inputHeight: 'auto',
            inputPlaceholder: this.placeholder,
            isInputActive: true,
            themeKind: 'dark',
            likedMessage: false,
            dislikedMessage: false,
            streamingAIMessage: false,
            hoveredReferenceLink: {},
        };
    };

    private _fetchToken = () => {
        return new Promise<string>((resolve, reject) => {
            if (this.resolveTokenPromise) {
                reject(new Error('Token already in use'));
                return;
            }
            this.resolveTokenPromise = resolve;
            vscode.postMessage({ auth: 'getToken' });
        });
    };

    private _fetchServerAddress = () => {
        return new Promise<string>((resolve, reject) => {
            if (this.resolveServerAddressPromise) {
                reject(new Error('Address already fetched'));
                return;
            }
            this.resolveServerAddressPromise = resolve;
            vscode.postMessage({ config: 'getServerAddress'});
        }); 
    };
    
    private _reset(): void {
        this.queryId = null;
        this.setState(this._initState());
    }

    private _logout(): void {
        this._reset();
        this.setState({ isLoggedIn: false });
    }

    componentDidMount(): void {
        window.addEventListener("message", this.handleMessage);
    }

    componentWillUnmount(): void {
        window.removeEventListener("message", this.handleMessage);
    }
    
    handleMessage = (event: MessageEvent) => {
        const message = event.data;

        if (message.token && this.resolveTokenPromise) {
            this.resolveTokenPromise(message.token);
            this.resolveTokenPromise = null;
        }
        if (message.serverAddress && this.resolveServerAddressPromise) {
            this.resolveServerAddressPromise(message.serverAddress);
            this.resolveServerAddressPromise = null;
        }
        if (message.themeKind) {
            this.setState({ themeKind: message.themeKind });
        }
        if (message.command) {
            switch (message.command) {
                case 'startNewSession':
                    this._reset();

                    if (message.searchText) {
                        this.setState({ input: message.searchText }, () => {
                            this.handleSubmit({ preventDefault: () => { } });
                        });
                    }
                    break;
            }
        }
        if (message.auth && message.auth === 'loggedIn') {
            this.setState({ isLoggedIn: true });
        }
        if (message.auth && message.auth === 'loggedOut') {
            this._logout();
        }
    };

    componentDidUpdate(prevProps: Readonly<AppProps>, prevState: Readonly<AppState>, snapshot?: any): void {
        const lastAiMessage = this.state.lastAiMessage;
        if (!lastAiMessage || !prevState.lastAiMessage || !this.chatEndRef.current) {
            return;
        }
        if (lastAiMessage.text !== prevState.lastAiMessage.text) {
            this.chatEndRef.current.scrollIntoView({ block: 'end', behavior: 'instant' });
        }
    }
  
    handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ input: e.target.value }, () => {
            const inputElement = this.inputRef.current;
            if (!inputElement) {
                return;
            }
            this.setState({
                inputHeight: 'auto',
            }, () => {
                this.setState({
                    inputHeight: `${inputElement.scrollHeight}px`,
                });
            });
        });
    };

    handlePlaceholder = () => {
        this.setState({ inputPlaceholder: this.queryId ? this.placeholderFollowUp : this.placeholder });
    };
  
    handleSubmit = (e: any) => {
        e.preventDefault();
        if (!this.state.isInputActive) {
            return;
        }
        const { input, messages } = this.state;
        if (input.trim()) {
            const userMessage = new Message(input, true);
            const assistantMessage = new Message('', false);
            this.setState({
                messages: [...messages, userMessage],
                lastAiMessage: assistantMessage,
                input: '',
                inputHeight: 'auto', // Reset input bar height
                inputPlaceholder: '',
                isInputActive: false,
            });
            this._fetchToken().then((token) => {
                this.streamingRequest(input, token);
            });
        }
    };

    handleNewLine = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        if (!this.state.isInputActive) {
            return;
        }
        const input = this.state.input;
        if (input.endsWith('\n')) {                
            const inputElement = this.inputRef.current;
            if (!inputElement) {
                return;
            }
            const inputLength = input.length;
            inputElement.selectionStart = inputLength;
            inputElement.selectionEnd = inputLength;
            return;
        }
        this.setState({ input: `${this.state.input}\n` });
    };

    handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            this.handleSubmit(e);
        } else if (e.key === 'Enter' && e.shiftKey) {
            this.handleNewLine(e);
        }
    };

    _addReaction = (reaction: string, token: string) => {
        const url = `${this.serverAddress}/add_reaction/${reaction}?query_id=${this.queryId}`;
        fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            }  
        }).then(response => {
            if (response.ok) {
                if (reaction === 'like') {
                    this.setState({ likedMessage: true, dislikedMessage: false });
                } else if (reaction === 'dislike') {
                    this.setState({ likedMessage: false, dislikedMessage: true });
                }
            } else {
                response.text().then(text => {
                    console.error(`Failed to add ${reaction} reaction. Status: ${response.status}, Response: ${text}`);
                });
            }
        }).catch(error => {
            console.error(error);
        });
    };

    _removeReaction = (reaction: string, token: string) => {
        const url = `${this.serverAddress}/remove_reaction/${reaction}?query_id=${this.queryId}`;
        fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            }      
        }).then(response => {
            if (response.ok) {
                if (reaction === 'like') {
                    this.setState({ likedMessage: false });
                } else if (reaction === 'dislike') {
                    this.setState({ dislikedMessage: false });
                }
            } else {
                response.text().then(text => {
                    console.error(`Failed to remove ${reaction} reaction. Status: ${response.status}, Response: ${text}`);
                });
            }
        }).catch(error => {
            console.error(error);
        });
    };
 
    handleLoginClick = () => {
        vscode.postMessage({ auth: 'login'});
    };
    
    handleLikeClick = () => {
        if (this.queryId === null) {
            return;
        }
        this._fetchToken().then((token) => {
            if (this.state.likedMessage) {
                this._removeReaction('like', token);
            }
            this._addReaction('like', token);
        });
    };

    handleDislikeClick = () => {
        if (this.queryId === null) {
            return;
        }
        this._fetchToken().then((token) => {
            if (this.state.dislikedMessage) {
                this._removeReaction('dislike', token);
            }
            this._addReaction('dislike', token);
        });
    };

    moveLastAiMessageToMessages = () => {
        const { messages, lastAiMessage: last_assistant_message } = this.state;
        if (last_assistant_message) {
            this.setState({
                messages: [...messages, last_assistant_message],
                lastAiMessage: null,
            });
        }
    };

    setLastAiMessage = (text: string) => {
        this.setState({lastAiMessage: new Message(text, false)});
    };

    streamingRequest(queryText: string, token: string): void {
        var url: string;
        const isFollowUp = this.queryId !== null;
        if (!isFollowUp) {
            const errorMessage = encodeURIComponent(`${queryText}`);
            this.setLastAiMessage('**Processing...**');
            url = `${this.serverAddress}/generate_solution?error_message=${errorMessage}`;
        } else {
            url = `${this.serverAddress}/follow_up?user_text=${queryText}&query_id=${this.queryId}`;
        }

        this.setState({ streamingAIMessage: true });
        fetch(url, {
            method: 'post',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        })
            .then(response => {
                if (response.status === 401) {
                    vscode.postMessage({ auth: 'logout'});
                    return;
                }
                else if (!response.ok) {
                    this.setLastAiMessage('Error fetching response');
                    this.setState({ streamingAIMessage: false });
                } else {
                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder('utf-8');

                    var firstTokenReceived: boolean = isFollowUp;
                    const readStream = (): void => {
                        reader?.read().then(({ done, value }) => {
                            if (!this.state.streamingAIMessage) {
                                return;
                            }
                            if (done) {
                                this.moveLastAiMessageToMessages();
                                this.handlePlaceholder();
                                this.setState({ isInputActive: true, streamingAIMessage: false });
                                return;
                            }
                            if (!firstTokenReceived) {
                                this.setLastAiMessage('');
                                firstTokenReceived = true;
                            }
                            const text = decoder.decode(value, { stream: true });
                            if (text.includes('- **QUERY ID:**')) {
                                const chunkSplit = text.split('- **QUERY ID:**');

                                this.setLastAiMessage(this.state.lastAiMessage?.text + `\n${chunkSplit[0]}`);
                                this.queryId = chunkSplit[1].trim();
                            } else {
                                this.setLastAiMessage(this.state.lastAiMessage?.text + text);
                            }
                            readStream();
                        });
                    };
                    readStream();
                }
            })
            .catch((error) => {
                this.setLastAiMessage(`Cathing error during fetching response ${error}`);
                this.setState({ streamingAIMessage: false });
            });
    }

    renderUserMessage = (msg: Message) => {
        return (
            <div className="message">
                <div className="user-details">
                    <img src={userLogo} alt="User Logo" className="user-logo" />
                    <span className="username">User</span>
                </div>
                <div className="message-text">{msg.text}</div>
            </div>
        );
    };

    codeComponent = (props: any) => {
        const child = props.children || '';
        const isCodeBlock = child.includes('\n');
        
        if (!isCodeBlock) {
            return <code>{child}</code>;
        }
        const codeContent = child.trim();
        const codeMatch = codeContent.match(/^([a-zA-Z]+)\n([\s\S]*)/);
        
        let language = '';
        let codeText = codeContent;
        
        if (codeMatch) {
            language = codeMatch[1]; 
            codeText = codeMatch[2];  
        }
        
        const style = this.state.themeKind === 'light' ? oneLight : oneDark;
        const themeOverrides = {
            fontSize: "x-small",
            fontFamily: "monospace",
            color: "var(--vscode-editor-background)",
            background: "var(--vscode-editor-background)",
        };
        return (
            <Prism
                customStyle={themeOverrides}
                style={style}
                language={language}
                showLineNumbers={false}
            >
                {codeText}
            </Prism>
        );
    };

    mouseHover = (event: React.MouseEvent<HTMLSpanElement>, previewData: { url: string }) => {
        const { clientX, clientY } = event;
        this.setState({
            hoveredReferenceLink: {
                previewData,
                x: clientX,
                y: clientY,
            },
        });
    };

    mouseLeave = () => {
        this.setState({ hoveredReferenceLink: {} });
    };

    renderAssistantMessage = (msg: Message) => {
        return (
            <div className="message">
                <div className="ai-message-header">
                    <div className="user-details">
                        <img src={assistantLogo} alt="Assistant Logo" className="assistant-logo" />
                        <span className="username">Scroll Assistant</span>
                    </div>
                    <div className="feedback-buttons">
                        <img 
                            src={this.state.likedMessage ? likedButton : likeButton} 
                            alt="Like" 
                            className="feedback-button" 
                            onClick={this.handleLikeClick}
                        />
                        <img 
                            src={this.state.dislikedMessage ? dislikedButton : dislikeButton} 
                            alt="Dislike" 
                            className="feedback-button" 
                            onClick={this.handleDislikeClick}
                        />
                    </div>
                </div>
                <div className="message-text-ai" ref={this.chatEndRef}>
                    <Markdown
                        options={{
                            overrides: {
                                ul: {
                                    component: (props: any) => <ul style={{ marginLeft: '10px'}} {...props}/>,
                                },
                                ol: {
                                    component: (props: any) => <ol style={{ marginLeft: '10px'}} {...props}/>,
                                },
                                li: {
                                    component: (props: any) => <li style={{ marginBottom: '10px'}} {...props}/>,
                                },
                                a: {
                                    component: ({ href, children }: any) => (
                                        <span
                                            data-tip
                                            data-for={href}
                                        >
                                            <a 
                                                href={href} 
                                                onMouseEnter={(e) => this.mouseHover(e, { url: href })} 
                                                onMouseLeave={this.mouseLeave}
                                            >
                                                {children}
                                            </a>
                                            {this.state.hoveredReferenceLink.previewData && (
                                            <FloatingPreview
                                                url={this.state.hoveredReferenceLink.previewData.url}
                                                x={this.state.hoveredReferenceLink.x || 0}
                                                y={this.state.hoveredReferenceLink.y || 0}
                                            />
                                            )}
                                        </span>
                                    ),
                                },
                                code: this.codeComponent,
                            }
                        }}
                    >
                        {msg.text}
                    </Markdown>
                </div>
            </div>
        );
    };

    renderMessage = (msg: Message, index: number) => {
        return (
            <div key={index} className="message-container">
                {index !== 0 && <hr className="message-separator" />}
                {msg.isUser ? this.renderUserMessage(msg) : this.renderAssistantMessage(msg)}
            </div>
        );
    };
  
    render_chat() {
        const { messages, input, inputHeight } = this.state;

        const isButtonEnabled = input.trim().length > 0 && this.state.isInputActive;
        return (
            <div className="chat-container">
                {messages.length > 0 && <hr className="top-separator"/>}
                <div className="conversation-view">
                    {messages.map((msg, index) => (
                        this.renderMessage(msg, index)
                    ))}
                    {this.state.lastAiMessage && this.renderMessage(this.state.lastAiMessage, messages.length)}
                </div>
                <hr className="io-separator" />
                <form className="input-bar" onSubmit={this.handleSubmit}>
                    <textarea
                        className="input"
                        style={{ height: inputHeight }}
                        value={input}
                        ref={this.inputRef}
                        placeholder={this.state.inputPlaceholder}
                        disabled={!this.state.isInputActive}
                        onChange={this.handleInputChange}
                        onKeyDown={this.handleKeyDown}
                        rows={1}
                    />
                    <button className="go-button">
                        <img src={goButton} style={{opacity: isButtonEnabled ? 1 : 0.2}}/>
                    </button>
                </form>
            </div>
        );
    }

    render_login() {
        const description = 'Access to extension is limited. Reach constantine7cd@gmail.com to request access.';
        return (
            <div className='login-container'>
                <text style={{width: '80%', textAlign: 'center'}}>
                    {description}
                </text>
                <h4 className='login-text'>Login to Continue</h4>
                <button className='login-button' onClick={this.handleLoginClick}>
                    Sign in with Google
                </button>
            </div>
        );
    }

    render() {
        if (this.state.isLoggedIn) {
            return this.render_chat();
        }
        return this.render_login();
    }
  }

render(<App />, document.getElementById('root'));
