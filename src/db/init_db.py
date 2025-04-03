import sqlite3
import os

def init_database():
    # Create database directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Connect to SQLite database (creates it if it doesn't exist)
    conn = sqlite3.connect('data/simulator.db')
    cursor = conn.cursor()

    # Create APs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS APs (
        id INTEGER PRIMARY KEY,
        x REAL,
        y REAL,
        z REAL,
        transmit_power REAL DEFAULT 20
    )
    ''')

    # Create Clients table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Clients (
        id INTEGER PRIMARY KEY,
        x REAL,
        y REAL,
        z REAL
    )
    ''')

    # Create RSSI table with indexes
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS RSSI (
        id INTEGER PRIMARY KEY,
        client_id INTEGER,
        ap_id INTEGER,
        rssi REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES Clients(id),
        FOREIGN KEY (ap_id) REFERENCES APs(id)
    )
    ''')
    
    # Create indexes for RSSI table
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_rssi_client ON RSSI(client_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_rssi_ap ON RSSI(ap_id)')

    # Create Messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Messages (
        id INTEGER PRIMARY KEY,
        client_id INTEGER,
        ap_id INTEGER,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES Clients(id),
        FOREIGN KEY (ap_id) REFERENCES APs(id)
    )
    ''')

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_database()