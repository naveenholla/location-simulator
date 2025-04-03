class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageCallbacks = new Map();
        this.connect();
    }

    connect() {
        this.socket = new WebSocket('ws://localhost:8000/ws');

        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            // Request current state after connection
            this.send({
                type: 'get_state'
            });
        };

        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connect(), 5000);
        };

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            const callback = this.messageCallbacks.get(message.type);
            if (callback) {
                callback(message);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    send(message) {
        if (this.isConnected) {
            this.socket.send(JSON.stringify(message));
        }
    }

    onMessage(type, callback) {
        this.messageCallbacks.set(type, callback);
    }

    setUpdateInterval(interval) {
        this.send({
            type: 'set_interval',
            interval: interval
        });
    }

    addAP(position) {
        this.send({
            type: 'add_ap',
            x: position.x,
            y: position.y,
            z: position.z
        });
    }

    addClient(position) {
        this.send({
            type: 'add_client',
            x: position.x,
            y: position.y,
            z: position.z
        });
    }

    removeAP(id) {
        this.send({
            type: 'remove_ap',
            id: id
        });
    }

    removeClient(id) {
        this.send({
            type: 'remove_client',
            id: id
        });
    }

    updateAPPosition(id, position) {
        this.send({
            type: 'update_ap_position',
            id: id,
            x: position.x,
            y: position.y,
            z: position.z
        });
    }

    updateClientPosition(id, position) {
        this.send({
            type: 'update_client_position',
            id: id,
            x: position.x,
            y: position.y,
            z: position.z
        });
    }

    clearAll() {
        // Remove RSSI update callback when clearing all devices
        this.messageCallbacks.delete('rssi_update');
        this.send({
            type: 'clear_all'
        });
    }
}

export default WebSocketManager;