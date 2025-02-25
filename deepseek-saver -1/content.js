console.log('DeepSeek Chat Saver content script loaded');

function extractContent() {
    console.log('Attempting to extract content...');
    
    // 问题的选择器
    const questionSelectors = [
        '.fa81',
        '[class*="user-message"]',
        '[class*="user"]'
    ];
    
    // 回答的选择器
    const answerSelectors = [
        '.ds-markdown.ds-markdown--block',
        '.markdown-body',
        '[class*="markdown"]',
        '.chat-message',
        '.message',
        '[class*="message"]',
        '.conversation-item',
        '[class*="conversation"]',
        '[class*="chat"]',
        '[class*="assistant"]'
    ];
    
    // 需要过滤的错误消息
    const errorMessages = [
        '服务器繁忙，请稍后再试',
        '出错了',
        'An error occurred',
        'Please try again later',
        'Network error',
        '网络错误'
    ];
    
    // 查找问题
    let questions = null;
    for (const selector of questionSelectors) {
        const found = document.querySelectorAll(selector);
        console.log(`Trying question selector "${selector}": found ${found.length} elements`);
        if (found.length > 0) {
            questions = found;
            console.log(`Using question selector: ${selector}`);
            break;
        }
    }
    
    // 查找回答
    let answers = null;
    for (const selector of answerSelectors) {
        const found = document.querySelectorAll(selector);
        console.log(`Trying answer selector "${selector}": found ${found.length} elements`);
        if (found.length > 0) {
            answers = found;
            console.log(`Using answer selector: ${selector}`);
            break;
        }
    }
    
    if ((!questions || questions.length === 0) && (!answers || answers.length === 0)) {
        // 如果都没找到，尝试获取整个主要内容区域
        console.log('No messages found with specific selectors, trying main content area...');
        const mainContent = document.querySelector('main') || 
                          document.querySelector('[role="main"]') ||
                          document.querySelector('.chat-container');
                          
        if (mainContent) {
            console.log('Found main content area:', mainContent);
            return mainContent.textContent;
        } else {
            console.log('No content found at all');
            return null;
        }
    }
    
    let markdown = '';
    let validPairs = [];
    
    // 首先收集所有有效的问答对
    const maxLength = Math.max(questions ? questions.length : 0, answers ? answers.length : 0);
    for (let i = 0; i < maxLength; i++) {
        let questionText = '';
        let answerElement = null;
        let isValid = true;
        
        // 获取问题文本
        if (questions && i < questions.length) {
            const question = questions[i];
            const questionElement = question.querySelector('.fbb737a4');
            questionText = questionElement ? questionElement.textContent.trim() : question.textContent.trim();
        }
        
        // 获取回答元素
        if (answers && i < answers.length) {
            const answer = answers[i];
            const answerText = answer.textContent.trim();
            
            // 检查是否包含错误消息
            if (errorMessages.some(error => answerText.includes(error))) {
                console.log('Skipping error message:', answerText);
                isValid = false;
            } else {
                answerElement = answer;
            }
        }
        
        // 如果问答对有效，添加到列表中
        if (isValid && questionText && answerElement) {
            validPairs.push({ 
                question: questionText, 
                answerElement: answerElement.cloneNode(true) // 克隆节点以保留完整结构
            });
        }
    }
    
    // 处理有效的问答对
    validPairs.forEach((pair, index) => {
        markdown += `# ${pair.question}\n\n`;
        markdown += '**Assistant**: \n\n';
        markdown += pair.answerElement.innerHTML + '\n\n'; // 使用 innerHTML 保留原始格式
        
        // 添加分隔符（除了最后一对）
        if (index < validPairs.length - 1) {
            markdown += '---\n\n';
        }
    });
    
    return markdown.trim();
}

// 检查对话是否完成
function isResponseComplete() {
    console.log('Checking if response is complete...');
    const loadingIndicator = document.querySelector('.loading-indicator');
    const stopButton = document.querySelector('.stop-button');
    const isComplete = !loadingIndicator && !stopButton;
    console.log('Response complete:', isComplete);
    return isComplete;
}

// 等待对话完成
async function waitForResponseComplete(timeout = 30000) {
    return new Promise((resolve, reject) => {
        if (isResponseComplete()) {
            resolve(true);
            return;
        }

        let checkInterval;
        const startTime = Date.now();
        
        checkInterval = setInterval(() => {
            if (isResponseComplete()) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error('Timeout waiting for response'));
            }
        }, 500);
    });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    if (request.action === 'saveChat') {
        console.log('Processing saveChat action');
        
        (async () => {
            try {
                console.log('Waiting for response to complete...');
                await waitForResponseComplete();
                
                console.log('Extracting content...');
                const content = extractContent();
                
                if (!content) {
                    console.error('No content found');
                    sendResponse({ success: false, error: 'No content found' });
                    return;
                }
                
                console.log('Content extracted successfully');
                sendResponse({ success: true, content: content });
            } catch (error) {
                console.error('Error in content script:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true; // 保持消息通道开放
    }
});

console.log('Content script initialization complete');