import sqlite3
import os

def check_database():
    # Connect to SQLite database
    db_path = 'data/simulator.db'
    if not os.path.exists(db_path):
        print(f"Database file {db_path} does not exist!")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check APs table
        cursor.execute('SELECT id, x, y, z, transmit_power FROM APs')
        aps = cursor.fetchall()
        print('\nCurrent AP Records:')
        for ap in aps:
            print(f'AP_{ap[0]}: position=({ap[1]}, {ap[2]}, {ap[3]}), power={ap[4]}')

        # Check for orphaned records in RSSI and Messages tables
        cursor.execute('''
            SELECT DISTINCT ap_id FROM RSSI 
            WHERE ap_id NOT IN (SELECT id FROM APs)
        ''')
        orphaned_rssi = cursor.fetchall()
        
        cursor.execute('''
            SELECT DISTINCT ap_id FROM Messages 
            WHERE ap_id NOT IN (SELECT id FROM APs)
        ''')
        orphaned_messages = cursor.fetchall()

        if orphaned_rssi or orphaned_messages:
            print('\nFound orphaned records for APs:')
            if orphaned_rssi:
                print('In RSSI table:', [ap[0] for ap in orphaned_rssi])
            if orphaned_messages:
                print('In Messages table:', [ap[0] for ap in orphaned_messages])

            # Clean up orphaned records
            cursor.execute('DELETE FROM RSSI WHERE ap_id NOT IN (SELECT id FROM APs)')
            cursor.execute('DELETE FROM Messages WHERE ap_id NOT IN (SELECT id FROM APs)')
            conn.commit()
            print('\nCleaned up orphaned records.')

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    check_database()