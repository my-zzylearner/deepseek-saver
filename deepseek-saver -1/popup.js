document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('saveButton');
    const formatSelect = document.getElementById('format');
    const statusDiv = document.getElementById('status');
    
    saveButton.addEventListener('click', async () => {
        try {
            saveButton.disabled = true;
            statusDiv.textContent = 'Connecting to page...';
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            // 检查是否在正确的页面
            if (!tab.url.includes('deepseek.com')) {
                throw new Error('Please use this extension on DeepSeek chat page');
            }
            
            statusDiv.textContent = 'Saving conversation...';
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'saveChat',
                format: formatSelect.value
            });
            
            if (!response) {
                throw new Error('No response from page. Please refresh and try again.');
            }
            
            if (response.success && response.content) {
                const blob = new Blob([response.content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = formatSelect.value === 'markdown' ? 'md' : 'txt';
                
                await chrome.downloads.download({
                    url: url,
                    filename: `deepseek-chat-${timestamp}.${extension}`,
                    saveAs: true
                });
                
                statusDiv.textContent = 'Conversation saved successfully!';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            } else {
                throw new Error(response.error || 'Failed to save conversation');
            }
        } catch (error) {
            console.error('Error:', error);
            statusDiv.textContent = `Error: ${error.message}. Please refresh the page and try again.`;
        } finally {
            saveButton.disabled = false;
        }
    });
}); 