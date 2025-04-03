Below is a detailed **Product Requirements Document (PRD)** and requirements specification for your application, which combines Python, Go, Three.js, and SQLite to simulate access points (APs) and clients on a floor map. The application will allow users to add and remove APs and clients via a UI, calculate distances between them, update RSSI (Received Signal Strength Indicator) values in a SQLite database at regular intervals (default 3 seconds or user-defined), and enable clients to push messages to the database based on their proximity to APs.

---

## Product Requirements Document (PRD)

### 1. Overview

#### 1.1 Purpose
The purpose of this application is to simulate a wireless network environment on a floor map, visualizing access points (APs) and clients in a 3D space using Three.js. Users can interactively add or remove APs and clients via a web-based UI, and the system will calculate distances and RSSI values, storing them in a SQLite database. Clients will also push messages to the database based on their distance from APs, with RSSI updates occurring every 3 seconds (or a custom interval specified by the user).

#### 1.2 Scope
The application will:
- Provide a 3D floor map interface using Three.js.
- Simulate APs and clients with positional data (x, y, z coordinates).
- Allow users to add/remove APs and clients through the UI.
- Calculate distances and RSSI values between clients and APs.
- Store simulation data (positions, RSSI, and client messages) in a SQLite database.
- Update RSSI values periodically (default: 3 seconds; customizable).
- Use Python for simulation logic and database management, Go for real-time features and web server functionality, and Three.js for visualization.

#### 1.3 Stakeholders
- **End Users**: Individuals or teams simulating wireless network behavior.
- **Developers**: The team building and maintaining the application.

---

### 2. Functional Requirements

#### 2.1 Visualization (Frontend - Three.js)
- **Floor Map**: Display a 3D representation of a floor map as the simulation environment.
- **APs and Clients**: Represent APs and clients as interactive 3D objects (e.g., spheres or icons) on the map.
- **User Interactions**:
  - **Add AP**: Users can click on the map to place a new AP, specifying its position (x, y, z).
  - **Add Client**: Users can click on the map to place a new client, specifying its position (x, y, z).
  - **Remove AP/Client**: Users can select an existing AP or client and remove it via a UI action (e.g., right-click or button).
  - **Optional**: Allow dragging APs and clients to new positions.
- **Real-time Updates**: Reflect changes (additions, removals, movements) in the UI instantly.

#### 2.2 Simulation Logic (Backend - Python)
- **Distance Calculation**: Compute the Euclidean distance between each client and AP using the formula:
  ```
  distance = √((x_c - x_a)² + (y_c - y_a)² + (z_c - z_a)²)
  ```
  where `(x_c, y_c, z_c)` is the client’s position and `(x_a, y_a, z_a)` is the AP’s position.
- **RSSI Calculation**: Calculate RSSI based on distance using a simplified model:
  ```
  RSSI = P_t - 20 * log₁₀(d)
  ```
  where `P_t` is the AP’s transmit power (default: 20 dBm, configurable) and `d` is the distance in meters.
- **Message Pushing**: Clients push a message (e.g., "Connected to AP_ID at RSSI_VALUE") to the database when within a threshold distance (e.g., 10 meters) of an AP.

#### 2.3 Real-time Features (Backend - Go)
- **Web Server**: Serve the Three.js frontend and handle API/WebSocket requests.
- **Periodic Updates**: Recalculate and update RSSI values for all client-AP pairs every 3 seconds (default) or a user-defined interval.
- **Real-time Communication**: Use WebSockets to:
  - Notify the frontend of database updates (e.g., new RSSI values).
  - Receive user actions (add/remove/move APs and clients) from the frontend.

#### 2.4 Database (SQLite)
- **Schema**:
  - **APs Table**:
    ```
    id (INTEGER PRIMARY KEY), x (REAL), y (REAL), z (REAL), transmit_power (REAL DEFAULT 20)
    ```
  - **Clients Table**:
    ```
    id (INTEGER PRIMARY KEY), x (REAL), y (REAL), z (REAL)
    ```
  - **RSSI Table**:
    ```
    id (INTEGER PRIMARY KEY), client_id (INTEGER), ap_id (INTEGER), rssi (REAL), timestamp (DATETIME)
    FOREIGN KEY (client_id) REFERENCES Clients(id), FOREIGN KEY (ap_id) REFERENCES APs(id)
    ```
  - **Messages Table**:
    ```
    id (INTEGER PRIMARY KEY), client_id (INTEGER), ap_id (INTEGER), message (TEXT), timestamp (DATETIME)
    FOREIGN KEY (client_id) REFERENCES Clients(id), FOREIGN KEY (ap_id) REFERENCES APs(id)
    ```
- **Operations**:
  - Insert new APs and clients when added via the UI.
  - Delete APs and clients (and related RSSI/messages) when removed.
  - Update RSSI values periodically.
  - Store client messages when triggered by proximity.

---

### 3. Non-Functional Requirements

#### 3.1 Performance
- **Scalability**: Handle up to 50 APs and 100 clients efficiently.
- **Update Frequency**: Support RSSI updates as frequent as every 1 second without significant lag.
- **Database**: Optimize queries with indexing on `client_id` and `ap_id` in the RSSI table.

#### 3.2 Usability
- **UI Intuitiveness**: Simple and clear controls for adding/removing APs and clients.
- **Feedback**: Provide visual confirmation (e.g., toast notifications) for user actions.

#### 3.3 Security
- **Input Validation**: Sanitize UI inputs to prevent SQL injection or malformed data.
- **Access Control**: If deployed online, implement basic authentication for user access.

#### 3.4 Reliability
- **Data Integrity**: Ensure database transactions are atomic (e.g., adding an AP updates all related tables correctly).
- **Error Handling**: Gracefully handle backend errors (e.g., database connection issues) with user-friendly messages.

---

### 4. Technical Requirements

#### 4.1 Technology Stack
- **Frontend**: Three.js (JavaScript) for 3D visualization, HTML/CSS for UI elements.
- **Backend**:
  - **Python**: Simulation logic (distance/RSSI calculations), SQLite database management, REST API (using Flask or FastAPI).
  - **Go**: Web server, WebSocket handling for real-time updates (using Gorilla WebSocket library).
- **Database**: SQLite for lightweight, local storage.
- **Communication**: HTTP REST API and WebSockets for frontend-backend interaction.

#### 4.2 Architecture
- **Frontend**: Three.js renders the floor map and handles user interactions, sending requests to the backend via REST or WebSockets.
- **Backend**:
  - **Python Service**: Manages simulation logic and database operations, exposing an API.
  - **Go Service**: Runs the web server, serves the frontend, and manages real-time updates via WebSockets.
- **Database**: SQLite file stored locally, accessed by Python.

#### 4.3 Data Flow
1. User adds/removes an AP or client via the UI.
2. Frontend sends the action to the Go server via WebSocket.
3. Go server forwards the request to the Python service via an internal API call.
4. Python updates the SQLite database and recalculates RSSI values.
5. Python notifies the Go server of changes.
6. Go server broadcasts updates to the frontend via WebSocket.
7. Frontend reflects changes in the UI.

---

### 5. User Interface Design

#### 5.1 Layout
- **Canvas**: A 3D floor map rendered with Three.js, occupying most of the screen.
- **Controls**:
  - Button: "Add AP" (prompts user to click on the map).
  - Button: "Add Client" (prompts user to click on the map).
  - Dropdown/Button: "Set Update Interval" (e.g., 1s, 3s, 5s, custom input).
  - Right-click on AP/Client: "Remove" option.

#### 5.2 Visual Elements
- **APs**: Red spheres with labels (e.g., "AP_1").
- **Clients**: Blue spheres with labels (e.g., "Client_1").
- **Hover Info**: Display position and RSSI values when hovering over an AP or client.

---

### 6. Milestones and Deliverables

#### 6.1 Phase 1: Prototype
- Set up Three.js floor map with basic AP/client visualization.
- Implement add/remove functionality in the UI.
- Create SQLite database with initial schema.

#### 6.2 Phase 2: Core Functionality
- Add distance and RSSI calculation logic in Python.
- Integrate Python with SQLite for data storage.
- Set up Go server with WebSocket support.

#### 6.3 Phase 3: Real-time Features
- Implement periodic RSSI updates (default 3 seconds).
- Enable client message pushing based on distance.
- Add custom interval option in the UI.

#### 6.4 Phase 4: Polish and Deploy
- Optimize performance (e.g., indexing, efficient calculations).
- Add UI feedback and error handling.
- Deploy locally or to a cloud server (optional).

---

### 7. Assumptions and Constraints

#### 7.1 Assumptions
- The floor map is a simple 3D plane (no complex building structures unless specified).
- Users have basic knowledge of wireless concepts (e.g., RSSI).
- The application runs locally unless online deployment is requested.

#### 7.2 Constraints
- SQLite limits scalability for very large simulations (consider alternatives like PostgreSQL for future expansion).
- Three.js performance may degrade with hundreds of objects; optimize rendering if needed.

---

### 8. Future Enhancements
- Add obstacle simulation (e.g., walls) affecting RSSI.
- Support importing floor map layouts (e.g., via JSON or image files).
- Implement client movement simulation (e.g., random walks).

---

This PRD provides a comprehensive blueprint for your application, covering functionality, technical details, and user experience. Let me know if you need further clarification or adjustments!