// ChatWindow component for displaying WebSocket messages
class ChatWindow {
    constructor() {
        this.debugMode = false;
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            right: 20px;
            top: 20px;
            width: 300px;
            height: 80vh;
            background-color: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            z-index: 1000;
        `;

        this.header = document.createElement('div');
        this.header.style.cssText = `
            padding: 10px;
            background-color: #2196F3;
            color: white;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = 'WebSocket Messages';
        
        const debugToggle = document.createElement('label');
        debugToggle.style.cssText = `
            display: flex;
            align-items: center;
            font-size: 12px;
            cursor: pointer;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.marginRight = '5px';
        checkbox.addEventListener('change', (e) => {
            this.debugMode = e.target.checked;
        });
        
        debugToggle.appendChild(checkbox);
        debugToggle.appendChild(document.createTextNode('Debug Mode'));
        
        this.header.appendChild(titleSpan);
        this.header.appendChild(debugToggle);

        this.messageContainer = document.createElement('div');
        this.messageContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
        `;

        this.container.appendChild(this.header);
        this.container.appendChild(this.messageContainer);
        document.body.appendChild(this.container);
    }

    addMessage(type, data) {
        // Only show RSSI updates and position changes
        if (type !== 'rssi_update' && type !== 'position_update') {
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            margin-bottom: 8px;
            padding: 8px;
            background-color: #f5f5f5;
            border-radius: 4px;
            word-wrap: break-word;
        `;

        const timestamp = new Date().toLocaleTimeString();
        const typeSpan = document.createElement('span');
        typeSpan.style.color = '#2196F3';
        typeSpan.textContent = `[${type}] `;

        const timeSpan = document.createElement('span');
        timeSpan.style.color = '#666';
        timeSpan.textContent = `${timestamp}: `;

        const contentSpan = document.createElement('span');
        if (type === 'rssi_update' && typeof data === 'object' && data !== null) {
            const client_id = data.client_id || data.client || data.id;
            const ap_id = data.ap_id || data.ap || data.access_point_id;
            const rssi = data.rssi || data.signal_strength;
            
            if (client_id !== undefined && ap_id !== undefined && rssi !== undefined) {
                if (this.debugMode) {
                    contentSpan.innerHTML = `
                        Client ${client_id} → AP ${ap_id}: <strong style="color: #e91e63">${rssi} dBm</strong><br>
                        <span style="color: #666; font-size: 11px">Raw data: ${JSON.stringify(data)}</span>
                    `;
                } else {
                    contentSpan.innerHTML = `Client ${client_id} → AP ${ap_id}: <strong style="color: #e91e63">${rssi} dBm</strong>`;
                }
            } else {
                contentSpan.textContent = JSON.stringify(data);
            }
        } else if (type === 'position_update' && typeof data === 'object' && data !== null) {
            const { client_id, x, y, z } = data;
            contentSpan.innerHTML = `Client ${client_id} moved to position: <strong style="color: #4caf50">(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})</strong>`;
        }

        messageElement.appendChild(typeSpan);
        messageElement.appendChild(timeSpan);
        messageElement.appendChild(contentSpan);

        this.messageContainer.appendChild(messageElement);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
}

export default ChatWindow;