import sqlite3
import os

def cleanup_database():
    # Connect to SQLite database
    db_path = 'data/simulator.db'
    if not os.path.exists(db_path):
        print(f"Database file {db_path} does not exist!")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Start a transaction
        cursor.execute('BEGIN TRANSACTION')

        # Delete all records from RSSI and Messages tables first
        cursor.execute('DELETE FROM RSSI')
        cursor.execute('DELETE FROM Messages')
        
        # Delete all APs and Clients
        cursor.execute('DELETE FROM APs')
        cursor.execute('DELETE FROM Clients')

        # Commit the transaction
        conn.commit()
        print('Successfully cleaned up all AP and Client records and related data.')

    except sqlite3.Error as e:
        # Rollback in case of error
        conn.rollback()
        print(f"Database error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    cleanup_database()