import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import WebSocketManager from './websocket';
import DragControlsManager from './dragControls';
import ContextMenu from './contextMenu';
import ChatWindow from './chatWindow';

class APClientSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.controls = null;
        this.dragControls = null;
        this.aps = new Map();
        this.clients = new Map();
        this.labels = new Map(); // Store labels separately
        this.isPlacingAP = false;
        this.isPlacingClient = false;
        this.nextAPId = 1;
        this.nextClientId = 1;
        this.wsManager = new WebSocketManager();
        this.contextMenu = new ContextMenu();
        this.chatWindow = new ChatWindow();

        this.init();
        this.setupEventListeners();
        this.setupWebSocketHandlers();
        this.animate();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Setup camera for 2D top-down view
        this.camera.position.set(0, 20, 0);
        this.camera.lookAt(0, 0, 0);

        // Setup controls with restricted rotation for 2D view
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.maxPolarAngle = 0;  // Restrict to top-down view
        this.controls.minPolarAngle = 0;
        this.controls.enableRotate = false;  // Disable rotation
        this.dragControls = new DragControlsManager(this.camera, this.renderer.domElement, this.wsManager);

        // Create floor with texture
        const floorGeometry = new THREE.PlaneGeometry(30, 30);
        const floorTexture = new THREE.TextureLoader().load('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjxwYXRoIGQ9Ik0wIDAgTDEwMCAxMDBNMTAwIDAgTDAgMTAwIiBzdHJva2U9IiNlMGUwZTAiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==');
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(15, 15);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: floorTexture,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Create office layout
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xaaccff,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1,
            metalness: 0.1
        });

        // Outer walls
        const createWall = (width, height, depth, position, rotation = 0) => {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, depth),
                wallMaterial
            );
            wall.position.set(...position);
            if (rotation) wall.rotation.y = rotation;
            this.scene.add(wall);
            return wall;
        };

        // Main outer walls
        createWall(0.3, 3, 30, [-15, 1.5, 0]); // Left wall
        createWall(0.3, 3, 30, [15, 1.5, 0]);  // Right wall
        createWall(30, 3, 0.3, [0, 1.5, -15]); // Back wall
        createWall(30, 3, 0.3, [0, 1.5, 15]);  // Front wall

        // Reception area
        createWall(8, 3, 0.3, [-6, 1.5, 10]); // Reception desk wall
        createWall(0.3, 3, 5, [-10, 1.5, 12.5]); // Reception side wall

        // Meeting rooms (glass walls)
        const createGlassWall = (width, height, depth, position, rotation = 0) => {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, depth),
                glassMaterial
            );
            wall.position.set(...position);
            if (rotation) wall.rotation.y = rotation;
            this.scene.add(wall);
            return wall;
        };

        // Meeting room 1
        createGlassWall(10, 3, 0.3, [-5, 1.5, 5]);
        createGlassWall(0.3, 3, 10, [-10, 1.5, 0], Math.PI / 2);

        // Meeting room 2
        createGlassWall(10, 3, 0.3, [5, 1.5, -5]);
        createGlassWall(0.3, 3, 10, [10, 1.5, -10], Math.PI / 2);

        // Office spaces and corridors
        createWall(0.3, 3, 15, [5, 1.5, 7.5]); // Office divider 1
        createWall(15, 3, 0.3, [-7.5, 1.5, 0]); // Main corridor
        createWall(0.3, 3, 10, [0, 1.5, -5]);   // Office divider 2

        // Add doors (represented as gaps in walls)
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
        const createDoor = (width, height, position, rotation = 0) => {
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, 0.1),
                doorMaterial
            );
            door.position.set(...position);
            if (rotation) door.rotation.y = rotation;
            this.scene.add(door);
            return door;
        };

        // Add doors to meeting rooms and offices
        createDoor(1, 2.5, [-5, 1.25, 5], Math.PI / 4);
        createDoor(1, 2.5, [5, 1.25, -5], Math.PI / 4);
        createDoor(1, 2.5, [-7.5, 1.25, -5]);
        createDoor(1, 2.5, [-7.5, 1.25, 5]);
        createDoor(1, 2.5, [0, 1.25, -5], Math.PI / 4);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(30, 30, 0x000000, 0x808080);
        this.scene.add(gridHelper);

        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Add directional light for better shadows and depth
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Add point lights for office areas
        const createPointLight = (x, z) => {
            const light = new THREE.PointLight(0xffffff, 0.3, 10);
            light.position.set(x, 3, z);
            this.scene.add(light);
        };

        // Add lights to different areas
        createPointLight(-7, 7);  // Reception
        createPointLight(-7, -7); // Office space 1
        createPointLight(7, -7);  // Meeting room 1
        createPointLight(7, 7);   // Meeting room 2
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());

        // Button event listeners
        document.getElementById('addAP').addEventListener('click', () => {
            this.isPlacingAP = true;
            this.isPlacingClient = false;
        });

        document.getElementById('addClient').addEventListener('click', () => {
            this.isPlacingAP = false;
            this.isPlacingClient = true;
            this.selectedClientType = 'mobile';
        });

        document.getElementById('addBeacon').addEventListener('click', () => {
            this.isPlacingAP = false;
            this.isPlacingClient = true;
            this.selectedClientType = 'beacon';
        });

        document.getElementById('addTag').addEventListener('click', () => {
            this.isPlacingAP = false;
            this.isPlacingClient = true;
            this.selectedClientType = 'tag';
        });

        // Clear all devices button listener
        document.getElementById('clearAll').addEventListener('click', () => {
            // Remove all APs and clients from the scene
            this.aps.forEach((ap) => {
                this.scene.remove(ap);
                this.dragControls.removeObject(ap);
            });
            this.clients.forEach((client) => {
                this.scene.remove(client);
                this.dragControls.removeObject(client);
            });
            
            // Clear the maps
            this.aps.clear();
            this.clients.clear();
            
            // Send clear all command to backend
            this.wsManager.clearAll();
        });

        // Update interval change listener
        document.getElementById('updateInterval').addEventListener('change', (event) => {
            this.wsManager.setUpdateInterval(parseInt(event.target.value));
        });

        // Click event for placing APs and Clients
        this.renderer.domElement.addEventListener('click', (event) => this.onCanvasClick(event));

        // Right click for removing objects
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.removeObjectAtMouse(event);
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    createAP(position) {
        const geometry = new THREE.SphereGeometry(0.3);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const ap = new THREE.Mesh(geometry, material);
        ap.position.copy(position);
        ap.userData.type = 'AP';

        this.scene.add(ap);  // Add AP to the scene
        this.wsManager.addAP(position);
        this.dragControls.addObject(ap);
        return ap;
    }

    createClient(position, clientType = 'mobile') {
        let geometry, material;
        
        switch(clientType) {
            case 'beacon':
                geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.4);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0x00ff00,
                    metalness: 0.7,
                    roughness: 0.3
                });
                break;
            case 'tag':
                geometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0xff00ff,
                    metalness: 0.5,
                    roughness: 0.5
                });
                break;
            default: // mobile device
                geometry = new THREE.SphereGeometry(0.2);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0x0000ff,
                    metalness: 0.6,
                    roughness: 0.4
                });
        }

        const client = new THREE.Mesh(geometry, material);
        client.position.copy(position);
        client.userData.type = 'Client';
        client.userData.clientType = clientType;
        client.userData.tempId = this.nextClientId++;

        this.scene.add(client);
        this.wsManager.addClient(position);
        this.dragControls.addObject(client);
        this.clients.set(client.userData.tempId, client); // Add to clients Map immediately
        return client;
    }

    addLabel(text, object) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = '48px Arial';
        context.fillStyle = 'white';
        context.fillText(text, 0, 48);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 1, 1);
        
        // Add sprite directly to scene instead of as child of object
        this.scene.add(sprite);
        // Store reference to both object and sprite
        this.labels.set(object.uuid, { sprite, object, offset: new THREE.Vector3(0, 1, 0) });
    }

    onCanvasClick(event) {
        if (!this.isPlacingAP && !this.isPlacingClient) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x, y }, this.camera);

        const intersects = raycaster.intersectObjects([this.scene.children[0]]); // Intersect with floor

        if (intersects.length > 0) {
            const position = intersects[0].point;
            if (this.isPlacingAP) {
                this.createAP(position);
                this.isPlacingAP = false;
            } else if (this.isPlacingClient) {
                this.createClient(position, this.selectedClientType);
                this.isPlacingClient = false;
            }
        }
    }

    removeObjectAtMouse(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x, y }, this.camera);

        const objects = [];
        this.aps.forEach(ap => objects.push(ap));
        this.clients.forEach(client => objects.push(client));

        const intersects = raycaster.intersectObjects(objects);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            const options = [
                {
                    label: `Remove ${object.userData.type}`,
                    color: '#ff0000',
                    action: () => {
                        if (object.userData.type === 'AP') {
                            const apId = object.userData.id;
                            if (apId === undefined) {
                                // Remove AP that hasn't been synchronized yet
                                this.scene.remove(object);
                                this.dragControls.removeObject(object);
                                return;
                            }
                            
                            // Set up handler before sending remove request
                            const removeHandler = (message) => {
                                if (message.id === apId) {
                                    this.aps.delete(apId);
                                    this.dragControls.removeObject(object);
                                    this.scene.remove(object);
                                    // Remove label if it exists
                                    const label = this.labels.get(object.uuid);
                                    if (label) {
                                        this.scene.remove(label.sprite);
                                        this.labels.delete(object.uuid);
                                    }
                                    // Remove the handler after successful removal
                                    this.wsManager.messageCallbacks.delete('ap_removed');
                                }
                            };
                            this.wsManager.onMessage('ap_removed', removeHandler);
                            this.wsManager.removeAP(apId);
                        } else if (object.userData.type === 'Client') {
                            const clientId = object.userData.id;
                            if (clientId === undefined) {
                                // Remove client that hasn't been synchronized yet
                                this.scene.remove(object);
                                this.dragControls.removeObject(object);
                                if (object.userData.tempId) {
                                    this.clients.delete(object.userData.tempId);
                                }
                                return;
                            }
                            
                            const removeHandler = (message) => {
                                if (message.id === clientId) {
                                    this.clients.delete(clientId);
                                    this.dragControls.removeObject(object);
                                    this.scene.remove(object);
                                    // Remove label if it exists
                                    const label = this.labels.get(object.uuid);
                                    if (label) {
                                        this.scene.remove(label.sprite);
                                        this.labels.delete(object.uuid);
                                    }
                                    // Remove the handler after successful removal
                                    this.wsManager.messageCallbacks.delete('client_removed');
                                }
                            };
                            this.wsManager.onMessage('client_removed', removeHandler);
                            this.wsManager.removeClient(clientId);
                        }
                    }
                }
            ];
            this.contextMenu.show(event.clientX, event.clientY, options);
        } else {
            this.contextMenu.hide();
        }
    }

    setupWebSocketHandlers() {
        this.wsManager.onMessage('ap_added', (message) => {
            // If AP with this ID already exists, don't create a duplicate
            if (this.aps.has(message.id)) {
                console.log(`AP with ID ${message.id} already exists`);
                return;
            }

            let ap;
            if (message.x !== undefined && message.y !== undefined && message.z !== undefined) {
                // Create new AP at specified position (from initial state or sync)
                const position = new THREE.Vector3(message.x, message.y, message.z);
                ap = this.createAP(position);
            } else {
                // Find the newly created AP without an ID
                ap = this.scene.children.find(child => 
                    child.userData.type === 'AP' && !child.userData.id
                );
            }

            if (ap) {
                ap.userData.id = message.id;
                this.aps.set(message.id, ap);
                this.addLabel(`AP_${message.id}`, ap);
                this.chatWindow.addMessage('ap_added', message);
            }
        });

        this.wsManager.onMessage('client_added', (message) => {
            // Check if this is an existing client from initial state
            if (message.x !== undefined && message.y !== undefined && message.z !== undefined) {
                const position = new THREE.Vector3(message.x, message.y, message.z);
                const client = this.createClient(position);
                client.userData.id = message.id;
                this.clients.set(message.id, client);
                this.addLabel(`Client_${message.id}`, client);
                this.chatWindow.addMessage('client_added', message);
                return;
            }

            // Handle newly added client
            const client = Array.from(this.clients.values()).find(child => 
                !child.userData.id && child.userData.tempId
            );
            if (client) {
                client.userData.id = message.id;
                // Update clients Map with permanent ID
                this.clients.delete(client.userData.tempId);
                this.clients.set(message.id, client);
                this.addLabel(`Client_${message.id}`, client);
                this.chatWindow.addMessage('client_added', message);
            }
        });

        // Log all WebSocket messages
        ['position_update', 'ap_removed', 'client_removed'].forEach(eventType => {
            this.wsManager.onMessage(eventType, (message) => {
                this.chatWindow.addMessage(eventType, message);
            });
        });
        
        // Handle RSSI updates
        this.wsManager.onMessage('rssi_update', (message) => {
            // Update client position in the UI if provided
            if (message.client_position && message.client_id) {
                const client = this.clients.get(message.client_id);
                if (client) {
                    // Update the client's position in the 3D scene
                    client.position.set(
                        message.client_position.x,
                        message.client_position.y,
                        message.client_position.z
                    );
                }
            }
            // Add message to chat window
            this.chatWindow.addMessage('rssi_update', message);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        
        // Update label positions
        this.labels.forEach(({sprite, object, offset}) => {
            const worldPosition = object.position.clone();
            sprite.position.copy(worldPosition.add(offset));
        });
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the simulator when the page loads
window.addEventListener('load', () => {
    new APClientSimulator();
});