import React, { Component, createRef } from 'react';
import { render } from 'react-dom';
import { Prism } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

import assistantLogo from './assets/assistant-logo.png';
import userLogo from './assets/user-logo.png';
import goButton from './assets/go-button.png';
import likeButton from './assets/like-button.png';
import dislikeButton from './assets/dislike-button.png';

import './App.css';

const Markdown = require('markdown-to-jsx');

const SERVER_ADDRESS = 'https://446c-109-236-92-134.ngrok-free.app';

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
}

class App extends Component<AppProps, AppState> {
    private inputRef: React.RefObject<HTMLTextAreaElement>;
    private chatEndRef: React.RefObject<HTMLDivElement>;
    private queryId: string | null = null;

    private placeholder: string = 'Paste error here...';
    private placeholderFollowUp: string = 'Follow Up';

    constructor(props: any) {
        super(props);
        this.state = {
            messages: [],
            lastAiMessage: null,
            input: '',
            inputHeight: 'auto',
            inputPlaceholder: this.queryId ? this.placeholderFollowUp : this.placeholder,
            isInputActive: true,
            themeKind: 'dark',
        };
        this.inputRef = createRef();
        this.chatEndRef = createRef();
    }

    componentDidMount(): void {
        window.addEventListener("message", this.handleMessage);
    }

    componentWillUnmount(): void {
        window.removeEventListener("message", this.handleMessage);
    }

    handleMessage = (event: MessageEvent) => {
        const message = event.data;
        this.setState({ themeKind: message.themeKind });
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
            this.streamingRequest(input);
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

    streamingRequest(queryText: string): void {
        var url: string;
        const isFollowUp = this.queryId !== null;
        if (!isFollowUp) {
            const errorMessage = encodeURIComponent(`${queryText}`);
            this.setLastAiMessage('**Processing...**');
            url = `${SERVER_ADDRESS}/generate_solution?error_message=${errorMessage}`;
        } else {
            url = `${SERVER_ADDRESS}/follow_up?user_text=${queryText}&query_id=${this.queryId}`;
        }

        fetch(url, {
            method: 'post'
        })
            .then(response => {
                if (!response.ok) {
                    this.setLastAiMessage('Error fetching response');
                } else {
                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder('utf-8');

                    var firstTokenReceived: boolean = isFollowUp;
                    const readStream = (): void => {
                        reader?.read().then(({ done, value }) => {
                            if (done) {
                                this.moveLastAiMessageToMessages();
                                this.handlePlaceholder();
                                this.setState({ isInputActive: true });
                                return;
                            }
                            if (!firstTokenReceived) {
                                this.setLastAiMessage('');
                                firstTokenReceived = true;
                            }
                            const text = decoder.decode(value, { stream: true });
                            if (text.includes('**QUERY ID:**')) {
                                this.queryId = text.split('**QUERY ID:**')[1].trim();
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
            });
    }

    renderUserMessage = (msg: Message) => {
        return (
            <div className="message">
                <div className="user-info">
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

    renderAssistantMessage = (msg: Message) => {
        return (
            <div className="message">
                <div className="user-info">
                    <img src={assistantLogo} alt="Assistant Logo" className="assistant-logo" />
                    <span className="username">Scroll Assistant</span>
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
  
    render() {
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
  }

render(<App />, document.getElementById('root'));
