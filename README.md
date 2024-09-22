# VR Zone Group Check-In System

The **VR Zone Group Check-In System** is designed to manage the check-in, game selection, and VR space allocation for both individual attendees and groups at VR gaming events. It integrates with Google Sheets to track check-ins, manage waitlists, and log session data in real time.

## Table of Contents
1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [Google Sheets Structure](#google-sheets-structure)
4. [Features](#features)
5. [How to Set Up](#how-to-set-up)
6. [Contributing](#contributing)
7. [License](#license)

---

## Project Overview

The VR Zone Group Check-In System automates the management of VR station assignments, game selection, and session tracking. The system provides real-time data on check-ins and check-outs, helping event organizers streamline the flow of attendees and manage VR station availability efficiently. 

For more details, see the full [Project Overview](docs/Project-Overview.md).

---

## File Structure

The repository contains the following files and folders:

```plaintext
|-- HTML/
    |-- GameSelection.html
    |-- GroupVRSpaceSelection.html
    |-- WaitlistSelection.html
    |-- CheckOutSelection.html
    |-- NoShowSelection.html
|-- Code.gs
|-- README.md
|-- docs/
    |-- Project-Overview.md
    |-- System-Structure.md
|-- LICENSE
```


#Breakdown of Key Files:



## Google Sheets Structure

The system relies on several Google Sheets that store data for tracking VR spaces, attendees, and session logs.

- **VRSpaces**: Tracks the availability and assignment of VR stations.
    - Columns: 
      - VR Space
      - Supported Games
      - Status (Available, Assigned, Occupied)
      - Attendee Name
      - Session ID
      - Check-In Time
      - Duration (optional)

- **Check-In Tracker**: Logs all check-ins and check-outs for session tracking and analytics.
    - Columns:
      - Session ID
      - Unique ID
      - First Name
      - Last Name
      - Game
      - VR Space
      - Check-In Time
      - Check-Out Time
      - Session Duration
      - Visit Count
      - Group Number (if applicable)

- **Waitlist**: Tracks attendees who are waiting for a VR space to become available.
    - Columns:
      - Session ID
      - First Name
      - Phone Number
      - Game
      - Waitlist Time
      - Notification Time
      - Group Number (if applicable)

---

## Features

### Group and Individual Check-In
- **Individual Check-In**: Attendees check in individually, select a game, and are assigned a VR space.
- **Group Check-In**: Groups of attendees can check in together and are each assigned a VR space.

### Game Selection
- The system allows attendees or groups to select a game from a predefined list, which can be customized in the `VRSpaces` sheet.

### Real-Time VR Space Assignment
- **Automatic Assignment**: The system checks the availability of VR spaces and assigns them based on the selected game.
- **Waitlist Support**: If no spaces are available, attendees are added to a waitlist and notified when a space opens up.

### Data Logging and Analytics
- Logs session details such as check-in/out times, session durations, and VR space usage, which can be used for reporting and analysis.

---

## How to Set Up

### Step 1: Google Sheets Setup
1. Create a new Google Sheets document.
2. Add the following sheets:
    - `VRSpaces`
    - `Check-In Tracker`
    - `Waitlist`
3. Structure the columns of each sheet as described in the [Google Sheets Structure](#google-sheets-structure) section.

### Step 2: Google Apps Script Setup
1. Open the Google Sheets document.
2. Navigate to **Extensions > Apps Script**.
3. Create a new script file named `Code.gs`.
4. Copy the code from the `Code.gs` file in this repository into your script editor.
5. Save the script.

### Step 3: HTML Setup
1. In the Apps Script editor, create new HTML files for each of the HTML templates (found in the `HTML` folder of this repository):
    - `GameSelection.html`
    - `GroupVRSpaceSelection.html`
    - `WaitlistSelection.html`
    - `CheckOutSelection.html`
    - `NoShowSelection.html`
2. Copy the HTML content from the corresponding files in the repository into each respective HTML file.

### Step 4: Permissions
- The system requires access to Google Sheets to read/write data. Make sure to authorize these permissions when prompted.

### Step 5: Testing
- Run the system by using the menu created in Google Sheets. You can start with an individual check-in or group check-in to ensure everything works as expected.

---

## Contributing

We welcome contributions to improve the VR Zone Group Check-In System! To contribute:
1. Fork the repository.
2. Create a new branch with your feature or fix.
3. Open a pull request with a clear description of your changes.

For major changes, please open an issue first to discuss what you would like to improve.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
