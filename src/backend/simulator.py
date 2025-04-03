from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import math
import json
from datetime import datetime
import asyncio

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Simulator:
    def __init__(self):
        self.db_path = 'data/simulator.db'
        self.update_interval = 3  # Default update interval in seconds
        self.active_connections = []  # List to store active WebSocket connections

    def get_db_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute('PRAGMA journal_mode=WAL')  # Use Write-Ahead Logging
        conn.execute('PRAGMA busy_timeout=5000')  # Set busy timeout to 5 seconds
        return conn

    def calculate_distance(self, client_pos, ap_pos):
        return math.sqrt(
            (client_pos[0] - ap_pos[0])**2 +
            (client_pos[1] - ap_pos[1])**2 +
            (client_pos[2] - ap_pos[2])**2
        )

    def calculate_rssi(self, distance, transmit_power):
        # Enhanced RSSI calculation with path loss exponent and reference distance
        # RSSI = Pt - (10 * n * log₁₀(d/d₀) + PL(d₀))
        # where n is path loss exponent (typically 2-4), d₀ is reference distance (1m)
        n = 3.0  # Path loss exponent for indoor environment
        d0 = 1.0  # Reference distance in meters
        pl_d0 = 40.0  # Path loss at reference distance
        
        # Ensure distance is not zero and calculate path loss
        distance = max(distance, d0)
        path_loss = pl_d0 + 10 * n * math.log10(distance/d0)
        rssi = transmit_power - path_loss
        
        # Clamp RSSI between -90 dBm (very weak) and -30 dBm (very strong)
        return max(min(rssi, -30), -90)

    async def update_rssi_values(self):
        while True:
            conn = None
            try:
                conn = self.get_db_connection()
                cursor = conn.cursor()

                # Get all clients and APs
                cursor.execute('SELECT id, x, y, z FROM Clients')
                clients = cursor.fetchall()
                cursor.execute('SELECT id, x, y, z, transmit_power FROM APs')
                aps = cursor.fetchall()

                # Calculate and update RSSI values
                for client in clients:
                    client_id, cx, cy, cz = client
                    print(f"\nProcessing Client {client_id} at position ({cx}, {cy}, {cz})")
                    
                    # Start transaction for each client's updates
                    conn.execute('BEGIN TRANSACTION')
                    try:
                        for ap in aps:
                            ap_id, ax, ay, az, transmit_power = ap
                            distance = self.calculate_distance((cx, cy, cz), (ax, ay, az))
                            rssi = self.calculate_rssi(distance, transmit_power)
                            print(f"  - AP {ap_id}: Distance = {distance:.2f}m, RSSI = {rssi:.2f} dBm")

                            # Clean up old RSSI and message records for this client-AP pair
                            cursor.execute('DELETE FROM RSSI WHERE client_id = ? AND ap_id = ?', (client_id, ap_id))
                            cursor.execute('DELETE FROM Messages WHERE client_id = ? AND ap_id = ?', (client_id, ap_id))

                            # Update RSSI in database
                            cursor.execute('''
                                INSERT INTO RSSI (client_id, ap_id, rssi)
                                VALUES (?, ?, ?)
                            ''', (client_id, ap_id, rssi))
                            print(f"    * Updated RSSI in database for Client {client_id} - AP {ap_id}")
                            
                            # Send RSSI update to all connected clients
                            rssi_update = {
                                'type': 'rssi_update',
                                'client_id': client_id,
                                'ap_id': ap_id,
                                'rssi': rssi,
                                'client_position': {'x': cx, 'y': cy, 'z': cz}
                            }
                            for connection in self.active_connections:
                                try:
                                    await connection.send_json(rssi_update)
                                except Exception as e:
                                    print(f"Error sending RSSI update to client: {e}")
                                    # Don't break the loop if one client fails

                            # Check if client is within range (10 meters) and add message
                            if distance <= 10:
                                message = f"Connected to AP_{ap_id} at {rssi:.2f} dBm"
                                cursor.execute('''
                                    INSERT INTO Messages (client_id, ap_id, message)
                                    VALUES (?, ?, ?)
                                ''', (client_id, ap_id, message))
                                print(f"    * Added connection message: {message}")
                        
                        conn.commit()
                    except Exception as e:
                        conn.rollback()
                        print(f"Error in transaction for client {client_id}: {e}")
                        raise

                await asyncio.sleep(self.update_interval)
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e):
                    print(f"Database is locked, waiting before retry: {e}")
                    await asyncio.sleep(1)  # Wait before retrying
                else:
                    print(f"Database error: {e}")
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"Error in update_rssi_values: {e}")
                await asyncio.sleep(1)  # Wait before retrying

simulator = Simulator()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connection_active = True
    simulator.active_connections.append(websocket)
    try:
        while connection_active:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                with simulator.get_db_connection() as conn:
                    cursor = conn.cursor()

                    try:
                        if message['type'] == 'get_state':
                            # Query current state from database
                            cursor.execute('SELECT id, x, y, z FROM APs')
                            aps = cursor.fetchall()
                            cursor.execute('SELECT id, x, y, z FROM Clients')
                            clients = cursor.fetchall()
                            
                            # Send current state to client
                            if connection_active:
                                # Send APs
                                for ap in aps:
                                    ap_id, x, y, z = ap
                                    await websocket.send_json({
                                        'type': 'ap_added',
                                        'id': ap_id,
                                        'x': x,
                                        'y': y,
                                        'z': z
                                    })
                                
                                # Send Clients
                                for client in clients:
                                    client_id, x, y, z = client
                                    await websocket.send_json({
                                        'type': 'client_added',
                                        'id': client_id,
                                        'x': x,
                                        'y': y,
                                        'z': z
                                    })

                        elif message['type'] == 'add_ap':
                            cursor.execute(
                                'INSERT INTO APs (x, y, z) VALUES (?, ?, ?)',
                                (message['x'], message['y'], message['z'])
                            )
                            ap_id = cursor.lastrowid
                            if connection_active:
                                await websocket.send_json({'type': 'ap_added', 'id': ap_id})

                        elif message['type'] == 'add_client':
                            cursor.execute(
                                'INSERT INTO Clients (x, y, z) VALUES (?, ?, ?)',
                                (message['x'], message['y'], message['z'])
                            )
                            client_id = cursor.lastrowid
                            if connection_active:
                                await websocket.send_json({'type': 'client_added', 'id': client_id})

                        elif message['type'] == 'remove_ap':
                            try:
                                # Start a transaction for atomic deletion
                                cursor.execute('BEGIN TRANSACTION')
                                # First delete related RSSI and Messages records
                                cursor.execute('DELETE FROM RSSI WHERE ap_id = ?', (message['id'],))
                                cursor.execute('DELETE FROM Messages WHERE ap_id = ?', (message['id'],))
                                # Then delete the AP
                                cursor.execute('DELETE FROM APs WHERE id = ?', (message['id'],))
                                # Commit the transaction
                                conn.commit()
                                if connection_active:
                                    await websocket.send_json({'type': 'ap_removed', 'id': message['id']})
                            except sqlite3.Error as e:
                                # Rollback in case of error
                                conn.rollback()
                                if connection_active:
                                    await websocket.send_json({'type': 'error', 'message': f'Failed to remove AP: {str(e)}'})
                                print(f'Error removing AP {message["id"]}: {str(e)}')

                        elif message['type'] == 'remove_client':
                            cursor.execute('DELETE FROM Clients WHERE id = ?', (message['id'],))
                            if connection_active:
                                await websocket.send_json({'type': 'client_removed', 'id': message['id']})

                        elif message['type'] == 'set_interval':
                            simulator.update_interval = message['interval'] / 1000  # Convert ms to seconds
                            if connection_active:
                                await websocket.send_json({'type': 'interval_updated'})

                        elif message['type'] == 'update_ap_position':
                            cursor.execute(
                                'UPDATE APs SET x = ?, y = ?, z = ? WHERE id = ?',
                                (message['x'], message['y'], message['z'], message['id'])
                            )
                            if connection_active:
                                await websocket.send_json({'type': 'ap_position_updated', 'id': message['id']})

                        elif message['type'] == 'update_client_position':
                            cursor.execute(
                                'UPDATE Clients SET x = ?, y = ?, z = ? WHERE id = ?',
                                (message['x'], message['y'], message['z'], message['id'])
                            )
                            if connection_active:
                                await websocket.send_json({'type': 'client_position_updated', 'id': message['id']})
                        
                        elif message['type'] == 'get_state':
                            # Get all APs
                            cursor.execute('SELECT id, x, y, z FROM APs')
                            aps = cursor.fetchall()
                            for ap in aps:
                                if connection_active:
                                    await websocket.send_json({
                                        'type': 'ap_added',
                                        'id': ap[0],
                                        'x': ap[1],
                                        'y': ap[2],
                                        'z': ap[3]
                                    })
                            
                            # Get all Clients
                            cursor.execute('SELECT id, x, y, z FROM Clients')
                            clients = cursor.fetchall()
                            for client in clients:
                                if connection_active:
                                    await websocket.send_json({
                                        'type': 'client_added',
                                        'id': client[0],
                                        'x': client[1],
                                        'y': client[2],
                                        'z': client[3]
                                    })

                    finally:
                        conn.commit()

            except json.JSONDecodeError:
                if connection_active:
                    await websocket.send_json({'type': 'error', 'message': 'Invalid JSON format'})
            except WebSocketDisconnect:
                connection_active = False
                break
            except Exception as e:
                if connection_active:
                    await websocket.send_json({'type': 'error', 'message': str(e)})

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if connection_active:
            await websocket.close()
        if websocket in simulator.active_connections:
            simulator.active_connections.remove(websocket)
        print("Client disconnected")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulator.update_rssi_values())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)